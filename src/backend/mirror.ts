import { t } from './localization'
import { basename, dirname, join } from './path'
import type { StorageFs } from './storageFs'
import { MirrorCancelled } from './jobLifetime'
import { formatBytes } from '../format'

/**
 * The mirror engine behind the backup plugin — a native replacement for the
 * `rsync -avhi --delete --backup --backup-dir=…` invocation this module used to
 * shell out to.
 *
 * It exists because rsync is not a thing you can rely on: Windows has none at
 * all, and even on macOS the stock binary is a 2.6.9 fork whose flags differ
 * from a Homebrew 3.x, which is why the old code carried a capability probe, a
 * PATH-rewriting env, three argv variants and an output parser. One
 * implementation in TypeScript is the same behaviour on all three platforms,
 * testable without a subprocess, and it reports its changes directly instead of
 * scraping them back out of `-i` itemized text.
 *
 * Semantics deliberately kept from rsync, because the UI and the trash layout
 * depend on them:
 *
 * - **The source's *contents* are mirrored** into the destination (rsync's
 *   trailing-slash rule), not the source folder itself.
 * - **`--delete`**: anything in the destination that is not in the source goes
 *   away — but never destructively. With `backupDir` set (`--backup
 *   --backup-dir`), every file the run would delete *or* overwrite is moved
 *   there first, under its original relative path.
 * - **Excludes** match the same fnmatch-style globs as before, against the
 *   source-relative path, and apply to deletion too, so a file the backup
 *   deliberately skips is never removed from the destination.
 * - **Modification test is size-or-mtime**, like rsync without `--checksum`.
 *   Copies preserve mtime, so a second run of an unchanged tree is a no-op.
 */

/** Files/dirs created, overwritten, or removed by a mirror run. */
export interface MirrorChanges {
  creates: string[]
  updates: string[]
  deletes: string[]
}

export interface MirrorOptions {
  source: string
  destination: string
  exclude: readonly string[]
  /** Escrow for overwritten/removed destination files. Omit to delete outright. */
  backupDir?: string
  /** Compute the plan without touching disk. */
  dryRun?: boolean
  /** Consistent staged files exposed at their original source-relative paths. */
  sourceOverrides?: ReadonlyMap<string, string>
  /** Free bytes on the destination's volume, or null when that is unknown. */
  freeBytes?: () => Promise<number | null>
}

export interface MirrorTick {
  percent: number
  files: { done: number; total: number }
  bytes: { done: number; total: number }
}

export interface MirrorOutcome extends MirrorChanges {
  ok: boolean
  cancelled?: boolean
  /** Files moved into `backupDir` — what the UI reports as "archived". */
  archived: number
  /** Files and links written into the destination. */
  copied: number
  /** Bytes of the files written into the destination. */
  bytes: number
  /**
   * One `rel: message` per entry the run could not handle. A backup is worth
   * more partially done than not at all, so a bad entry is recorded and skipped
   * rather than thrown — a single unreadable file used to abandon the rest of
   * the folder, which on a live source tree (a build writing into it, a cache
   * rotating) is a routine event rather than an exceptional one.
   */
  errors: string[]
  message?: string
}

/** fnmatch-style glob (only `*`, matching across separators) used for excludes. */
export function globMatch(text: string, pattern: string): boolean {
  let compiled = compiledGlobs.get(pattern)
  if (!compiled) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    compiled = new RegExp(`^${escaped}$`, 's')
    compiledGlobs.set(pattern, compiled)
  }
  return compiled.test(text)
}

const compiledGlobs = new Map<string, RegExp>()

/** Whether a source-relative path is excluded. Trailing-slash form matches dirs. */
export function isExcluded(relPath: string, excludes: readonly string[]): boolean {
  return excludes.some((p) => globMatch(relPath, p) || globMatch(`${relPath}/`, p))
}

/** One entry of a scanned tree, keyed by its NFC-normalized relative path. */
interface Entry {
  /** The relative path as spelled on disk, which every file operation uses. */
  rel: string
  kind: 'file' | 'dir' | 'symlink'
  size: number
  mtimeMs: number
  /** Link target, for symlinks. */
  target?: string
}

/**
 * Whether a destination entry needs rewriting. Mirrors rsync's default quick
 * check (size, then mtime) rather than hashing every file.
 *
 * The 2 s tolerance is not slop: FAT/exFAT — the format of most portable
 * drives, and the reason this module already has an exFAT sweep — stores
 * mtimes at 2-second granularity, so a faithful copy onto one reads back up to
 * 2 s off. Without the tolerance every file would look modified on every run,
 * turning an incremental backup into a full re-copy each time.
 */
function differs(source: Entry, dest: Entry): boolean {
  if (source.kind !== dest.kind) return true
  if (source.kind === 'symlink') return source.target !== dest.target
  if (source.kind === 'dir') return false
  return source.size !== dest.size || Math.abs(source.mtimeMs - dest.mtimeMs) > 2000
}

/** Move a destination entry into the escrow dir, preserving its relative path.
 *  `made` remembers escrow directories this run already created. */
async function escrow(fs: StorageFs, destRoot: string, backupDir: string, rel: string, made: Set<string>): Promise<void> {
  const from = join(destRoot, ...rel.split('/'))
  const to = join(backupDir, ...rel.split('/'))
  const parent = dirname(to)
  if (!made.has(parent)) {
    await fs.mkdir(parent, { recursive: true })
    made.add(parent)
  }
  try {
    await fs.rename(from, to)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | null)?.code
    // The escrow already holds a non-empty directory at this path, so rename
    // refuses. `deletionRoots` is what keeps the delete side from producing
    // that collision; this is the safety net for every other way two moves can
    // land on one escrow path (a residue from an interrupted run, a restore
    // into an existing escrow dir). Merge: move what is left in child by child,
    // then drop the emptied source directory.
    if (code === 'ENOTEMPTY' || code === 'EEXIST') {
      const stat = await fs.lstat(from).catch((error) => { if (error instanceof MirrorCancelled) throw error; return null })
      if (!stat?.isDirectory()) throw err
      made.add(to)
      for (const name of await fs.readdir(from)) await escrow(fs, destRoot, backupDir, `${rel}/${name}`, made)
      await fs.rmdir(from)
      return
    }
    // Crossing a filesystem boundary (the escrow may live on another volume)
    // makes rename fail with EXDEV — and *only* EXDEV — so fall back to
    // copy-then-remove for that one code. Every other failure (a lock, a
    // permission, a vanished path) is a real error: swallowing it here would
    // copy the entry and then leave the destination copy behind, which reads
    // as a successful archive of a file that was never removed.
    if (code !== 'EXDEV') throw err
    await fs.cp(from, to, { recursive: true, force: true })
    await fs.rm(from, { recursive: true, force: true })
  }
}

/**
 * Copy one source entry over the destination, preserving mtime. Parents already
 * exist: directories are created shallow-first before any file is copied, and
 * an update replaces an entry whose parent survived.
 *
 * A file is written beside its target and renamed into place, so a copy that
 * dies halfway never leaves a truncated file under the real name. `destRel` is
 * the spelling the destination already uses for an update.
 */
async function copyEntry(
  fs: StorageFs,
  sourceRoot: string,
  destRoot: string,
  entry: Entry,
  sourceOverrides?: ReadonlyMap<string, string>,
  destRel = entry.rel
): Promise<void> {
  const from = sourceOverrides?.get(entry.rel) ?? join(sourceRoot, ...entry.rel.split('/'))
  const to = join(destRoot, ...destRel.split('/'))
  if (entry.kind === 'dir') {
    await fs.mkdir(to, { recursive: true })
    return
  }
  if (entry.kind === 'symlink') {
    await fs.rm(to, { force: true, recursive: true }).catch((error) => { if (error instanceof MirrorCancelled) throw error })
    // 'junction' is what Windows accepts without Developer Mode; it only applies
    // to directory targets, and Node ignores the hint elsewhere.
    await fs.symlink(entry.target ?? '', to, 'junction')
    return
  }
  // rsync -a preserves times, and the next run's quick check depends on it. The
  // copy itself already landed, so a stamp lost to cancellation only means the
  // next run copies this file once more; it must not disown the copy.
  const stamp = async (path: string): Promise<void> => {
    try {
      await fs.utimes(path, new Date(), new Date(entry.mtimeMs))
    } catch {
      // best-effort stamp
    }
  }
  if (new TextEncoder().encode(basename(to)).length + STAGED_SUFFIX.length > MAX_NAME_BYTES) {
    await fs.copyFile(from, to)
    await stamp(to)
    return
  }
  const staged = `${to}${STAGED_SUFFIX}`
  try {
    await fs.copyFile(from, staged)
    await stamp(staged)
    await fs.commit(staged, to)
  } catch (error) {
    await fs.rm(staged, { force: true }).catch(() => undefined)
    throw error
  }
}

/** How much one planned entry weighs against copied bytes in the progress bar. */
const ENTRY_WEIGHT = 64 * 1024
/** Copies and updates in flight at once; directories and deletes stay sequential. */
const COPY_WORKERS = 8
/** Folder pairs compared at once. */
const SCAN_WORKERS = 12
/** Changed paths reported per bucket. Counters stay exact beyond this. */
const PATHS_KEPT = 5000
/** Failure messages retained; the run log has every one. */
const ERRORS_KEPT = 1000
/** Changed folders remembered between the survey and the copy; beyond this the copy walks everything. */
const CHANGED_DIRS_KEPT = 100_000
/** Plugin backends get 1 s of CPU per turn; a long loop hands the turn back well before that. */
const PAUSE_AFTER_MS = 200
/** Suffix of a file still being written; scans exclude it (see mirrorExcludes). */
export const STAGED_SUFFIX = '.tmp.backup'
const MAX_NAME_BYTES = 255
/** Left free on the destination drive beyond the bytes a run copies. */
const FREE_SPACE_RESERVE = 256 * 1024 * 1024

/**
 * Run `work` over `items` with at most `width` in flight. Every worker is
 * joined before this settles, so a cancellation never leaves a copy running
 * behind the caller's back; the first rejection is rethrown after that.
 */
async function pool<T>(items: readonly T[], width: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) await work(items[next++])
  }
  const settled = await Promise.allSettled(Array.from({ length: Math.min(width, items.length) }, worker))
  const failure = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failure) throw failure.reason
}

/** One directory being compared. A side is null when the directory exists only on the other. */
interface DirPair {
  /** NFC path, which excludes and name matching use. */
  key: string
  src: string | null
  dest: string | null
}

/**
 * Run `visit` over a growing set of items, depth first, so the frontier stays
 * small on a very wide tree. The first rejection stops the walk once every
 * in-flight visit has returned.
 */
async function walk<T>(start: T[], width: number, visit: (item: T, push: (item: T) => void) => Promise<void>): Promise<void> {
  const stack = [...start]
  let active = 0
  let failure: { reason: unknown } | undefined
  let waiting: Array<() => void> = []
  const wake = (): void => { const woken = waiting; waiting = []; for (const resume of woken) resume() }
  const worker = async (): Promise<void> => {
    for (;;) {
      const item = failure ? undefined : stack.pop()
      if (item === undefined) {
        if (active === 0 || failure) { wake(); return }
        await new Promise<void>((resume) => waiting.push(resume))
        continue
      }
      active++
      try {
        await visit(item, (next) => stack.push(next))
      } catch (reason) {
        failure ??= { reason }
      } finally {
        active--
        wake()
      }
    }
  }
  await Promise.all(Array.from({ length: width }, worker))
  if (failure) throw failure.reason
}

/**
 * Mirror `source` into `destination`. Emits one log line per action through
 * `onLine` and throttled progress — percent weighted by bytes, plus entry and
 * byte counters — through `onProgress`.
 *
 * Plugin backends have a small heap and short CPU turns, and a source can hold
 * millions of entries, so no tree is ever held in memory. A survey compares one
 * directory pair at a time and keeps only counters and the directories that
 * changed; every refusal happens there, before anything is touched. The copy
 * then lists only those directories again.
 */
export function createMirrorEngine(fs: StorageFs) {
  return async function mirrorTree(
    opts: MirrorOptions,
    onLine: (line: string) => void = () => {},
    onProgress: (progress: MirrorTick) => void = () => {}
  ): Promise<MirrorOutcome> {
    const { source, destination, backupDir, dryRun = false } = opts
    const exclude = opts.exclude.map((pattern) => pattern.normalize('NFC'))
    const sourceOverrides = opts.sourceOverrides ? new Map(opts.sourceOverrides) : undefined
    let archived = 0
    let copied = 0
    let copiedBytes = 0
    let failed = 0
    const plan: MirrorChanges = { creates: [], updates: [], deletes: [] }
    const errors: string[] = []
    const empty = { archived: 0, copied: 0, bytes: 0, creates: [], updates: [], deletes: [] }
    const fail = (message: string): void => {
      failed++
      if (errors.length < ERRORS_KEPT) errors.push(message)
    }
    let lastPause = Date.now()
    const breathe = async (): Promise<void> => {
      fs.assertActive()
      if (Date.now() - lastPause < PAUSE_AFTER_MS) return
      await new Promise<void>((resume) => setTimeout(resume, 0))
      lastPause = Date.now()
    }
    const childOf = (parent: string, name: string): string => (parent ? `${parent}/${name}` : name)
    const absolute = (root: string, rel: string): string => (rel ? join(root, ...rel.split('/')) : root)

    /** Entries the staged snapshot adds to a source directory, by NFC parent path. */
    const staged = new Map<string, Map<string, Entry>>()
    const addStaged = (parent: string, name: string, entry: Entry): void => {
      const children = staged.get(parent) ?? new Map<string, Entry>()
      if (entry.kind === 'file' || !children.has(name)) children.set(name, entry)
      staged.set(parent, children)
    }

    /**
     * One directory's entries by NFC name, excluded ones left out. Listing
     * entries are lstat results: a symlink is mirrored as a link, never followed.
     * A `strict` listing returns null on any failure, because the caller is about
     * to change things. Otherwise a vanished folder reads as empty and an
     * unreadable one is reported, which makes the survey refuse the run.
     */
    const list = async (root: string, rel: string, key: string, strict: boolean, withStaged: boolean): Promise<Map<string, Entry> | null> => {
      const entries = new Map<string, Entry>()
      const path = absolute(root, rel)
      const stagedOnly = withStaged && staged.has(key)
      const unreadable = (error: unknown): void => {
        if (error instanceof MirrorCancelled) throw error
        if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT' || (strict && !stagedOnly)) fail(`${path}: ${error instanceof Error ? error.message : String(error)}`)
      }
      let readable = true
      try {
        for (const dirent of await fs.readdir(path, { withFileTypes: true })) {
          await breathe()
          const name = dirent.name.normalize('NFC')
          if (isExcluded(childOf(key, name), exclude)) continue
          const entryRel = childOf(rel, dirent.name)
          if (dirent.isSymbolicLink()) {
            try {
              entries.set(name, { rel: entryRel, kind: 'symlink', size: 0, mtimeMs: dirent.mtimeMs, target: await fs.readlink(join(path, dirent.name)) })
            } catch (error) {
              unreadable(error)
              readable = false
            }
          } else if (dirent.isDirectory()) entries.set(name, { rel: entryRel, kind: 'dir', size: 0, mtimeMs: dirent.mtimeMs })
          else if (dirent.isFile()) entries.set(name, { rel: entryRel, kind: 'file', size: dirent.size, mtimeMs: dirent.mtimeMs })
        }
      } catch (error) {
        unreadable(error)
        readable = (error as NodeJS.ErrnoException | null)?.code === 'ENOENT' && stagedOnly
      }
      if (withStaged) for (const [name, entry] of staged.get(key) ?? []) if (entry.kind === 'file' || !entries.has(name)) entries.set(name, entry)
      return strict && !readable ? null : entries
    }

    try {
      fs.assertActive()
      try {
        const stat = await fs.stat(source)
        if (!stat.isDirectory()) {
          const message = t('backend.sourceNotFolder', { path: source })
          return { ok: false, ...empty, errors: [message], message }
        }
        for (const [rel, path] of sourceOverrides ?? []) {
          const staging = await fs.lstat(path)
          if (!staging.isFile()) throw new Error(t('backend.stagedNotFile', { path: rel }))
          const parts = rel.split('/')
          for (let index = 0; index < parts.length; index++) {
            const parent = parts.slice(0, index).join('/')
            const entryRel = parts.slice(0, index + 1).join('/')
            const isFile = index === parts.length - 1
            addStaged(parent.normalize('NFC'), parts[index].normalize('NFC'), { rel: entryRel, kind: isFile ? 'file' : 'dir', size: isFile ? staging.size : 0, mtimeMs: staging.mtimeMs })
          }
        }
      } catch (error) {
        if (error instanceof MirrorCancelled) throw error
        const message = t('backend.sourceUnavailable', { path: source })
        return { ok: false, ...empty, errors: [message], message }
      }

      const total = { creates: 0, updates: 0, deletes: 0, bytes: 0 }
      const changedDirs: DirPair[] = []
      let walkEverything = false
      let sourceRootEmpty = false
      const keep = (bucket: string[], path: string): void => { if (bucket.length < PATHS_KEPT) bucket.push(path) }
      const countCreate = (entry: Entry, key: string): void => {
        total.creates++
        total.bytes += entry.kind === 'file' ? entry.size : 0
        keep(plan.creates, key)
      }
      const countDelete = (key: string): void => { total.deletes++; keep(plan.deletes, key) }
      await walk<DirPair>([{ key: '', src: '', dest: '' }], SCAN_WORKERS, async (dir, push) => {
        const sourceEntries = dir.src === null ? new Map<string, Entry>() : (await list(source, dir.src, dir.key, false, true))!
        const destEntries = dir.dest === null ? new Map<string, Entry>() : (await list(destination, dir.dest, dir.key, false, false))!
        if (dir.key === '') sourceRootEmpty = sourceEntries.size === 0
        let changed = false
        for (const [name, entry] of sourceEntries) {
          await breathe()
          const key = childOf(dir.key, name)
          const existing = destEntries.get(name)
          if (!existing) {
            countCreate(entry, key)
            changed = true
            if (entry.kind === 'dir') push({ key, src: entry.rel, dest: null })
          } else if (existing.kind !== entry.kind) {
            // A path that changed kind vacates before its new children arrive.
            countDelete(key)
            countCreate(entry, key)
            changed = true
            if (existing.kind === 'dir') push({ key, src: null, dest: existing.rel })
            if (entry.kind === 'dir') push({ key, src: entry.rel, dest: null })
          } else if (differs(entry, existing)) {
            total.updates++
            total.bytes += entry.kind === 'file' ? entry.size : 0
            keep(plan.updates, key)
            changed = true
          } else if (entry.kind === 'dir') push({ key, src: entry.rel, dest: existing.rel })
        }
        for (const [name, existing] of destEntries) {
          if (sourceEntries.has(name)) continue
          await breathe()
          const key = childOf(dir.key, name)
          countDelete(key)
          changed = true
          if (existing.kind === 'dir') push({ key, src: null, dest: existing.rel })
        }
        if (changed && dir.src !== null && dir.dest !== null) {
          if (changedDirs.length < CHANGED_DIRS_KEPT) changedDirs.push(dir)
          else walkEverything = true
        }
      })
      fs.assertActive()
      plan.creates.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
      plan.deletes.sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b))
      plan.updates.sort()

      // Both refusals leave the destination untouched: an incomplete scan or an
      // emptied source would otherwise delete everything backed up.
      if (failed) {
        const message = t('backend.scanFailed', { count: failed, error: errors[0] })
        return { ok: false, ...empty, errors, message }
      }
      if (sourceRootEmpty && total.deletes > 0) {
        const message = t('backend.emptySource', { path: source, count: total.deletes })
        return { ok: false, ...empty, errors: [message], message }
      }

      if (dryRun) return { ok: true, archived: 0, copied: 0, bytes: 0, errors: [], ...plan }

      const files = { done: 0, total: total.creates + total.updates + total.deletes }
      const bytes = { done: 0, total: total.bytes }
      // Only copies need room: a run that just deletes has to work on a full drive.
      const free = bytes.total > 0 && opts.freeBytes ? await opts.freeBytes() : null
      fs.assertActive()
      if (free !== null && bytes.total + FREE_SPACE_RESERVE > free) {
        const message = t('backend.notEnoughSpace', { needed: formatBytes(bytes.total + FREE_SPACE_RESERVE, 'en'), free: formatBytes(free, 'en') })
        return { ok: false, ...empty, errors: [message], message }
      }
      const weightTotal = files.total * ENTRY_WEIGHT + bytes.total
      let lastPercent = -1
      let lastEmit = 0
      // `entries` is how much of the plan one operation accounts for: a doomed
      // directory is removed in one go but stands for its whole subtree.
      const tick = (entries: number, size: number): void => {
        files.done += entries
        bytes.done += size
        if (weightTotal === 0) return
        const pct = Math.min(100, Math.floor(((files.done * ENTRY_WEIGHT + bytes.done) / weightTotal) * 100))
        const now = Date.now()
        if (pct !== lastPercent || now - lastEmit >= 250) {
          lastPercent = pct
          lastEmit = now
          onProgress({ percent: pct, files: { ...files }, bytes: { ...bytes } })
        }
      }

      // One entry's failure is that entry's failure. Everything else in the folder
      // still has to transfer, so each step is guarded on its own and the run keeps
      // going; the collected list is what the caller reports.
      const attempt = async (rel: string, step: () => Promise<void>, entries = 1, size = 0): Promise<void> => {
        fs.assertActive()
        try {
          await step()
        } catch (err) {
          if (err instanceof MirrorCancelled) throw err
          const message = `${rel}: ${err instanceof Error ? err.message : String(err)}`
          fail(message)
          onLine(`  [!] ${message}`)
        }
        tick(entries, size)
      }

      try {
        await fs.mkdir(destination, { recursive: true })
      } catch (err) {
        if (err instanceof MirrorCancelled) throw err
        const message = err instanceof Error ? err.message : String(err)
        onLine(`  [!] ${message}`)
        return { ok: false, archived, copied, bytes: copiedBytes, ...plan, errors: [message], message }
      }

      const escrowDirs = new Set<string>()

      /**
       * A doomed directory goes as a unit, which is what makes the escrow possible
       * and is one rename instead of thousands. Anything excluded below it pins it:
       * moving it would take along the one file the excludes exist to keep.
       */
      const inspectDoomed = async (rel: string, key: string): Promise<{ entries: number; pinned: boolean }> => {
        const pending = [{ rel, key }]
        let entries = 1
        for (let dir = pending.pop(); dir; dir = pending.pop()) {
          let listing
          try {
            listing = await fs.readdir(absolute(destination, dir.rel), { withFileTypes: true })
          } catch (error) {
            if (error instanceof MirrorCancelled) throw error
            return { entries, pinned: true }
          }
          for (const dirent of listing) {
            await breathe()
            const childKey = childOf(dir.key, dirent.name.normalize('NFC'))
            if (isExcluded(childKey, exclude)) return { entries, pinned: true }
            entries++
            if (dirent.isDirectory()) pending.push({ rel: childOf(dir.rel, dirent.name), key: childKey })
          }
        }
        return { entries, pinned: false }
      }

      const removeFromDestination = async (entry: Entry, key: string): Promise<void> => {
        const { entries, pinned } = entry.kind === 'dir' ? await inspectDoomed(entry.rel, key) : { entries: 1, pinned: false }
        if (pinned) {
          const children = await list(destination, entry.rel, key, true, false)
          for (const [name, child] of children ?? []) await removeFromDestination(child, childOf(key, name))
          tick(1, 0)
          return
        }
        await attempt(entry.rel, async () => {
          if (backupDir) {
            await escrow(fs, destination, backupDir, entry.rel, escrowDirs)
            archived += entries
            onLine(t('backend.archiveLine', { path: entry.rel }))
          } else {
            await fs.rm(absolute(destination, entry.rel), { recursive: true, force: true })
          }
          onLine(t('backend.deleteLine', { path: entry.rel }))
        }, entries)
      }

      const copyLeaves = (leaves: Array<{ entry: Entry; destRel?: string; archive: boolean }>): Promise<void> =>
        pool(leaves, COPY_WORKERS, ({ entry, destRel, archive }) => {
          const size = entry.kind === 'file' ? entry.size : 0
          return attempt(entry.rel, async () => {
            if (archive && backupDir) {
              await escrow(fs, destination, backupDir, destRel ?? entry.rel, escrowDirs)
              archived++
              onLine(t('backend.archiveLine', { path: destRel ?? entry.rel }))
            }
            await copyEntry(fs, source, destination, entry, sourceOverrides, destRel)
            copied++
            copiedBytes += size
            onLine(`  ${entry.rel}`)
          }, 1, size)
        })

      /** Parents before children, then that directory's files through the pool. */
      const createAll = async (first: Entry[], firstKey: string): Promise<void> => {
        const pending = [{ entries: first, key: firstKey }]
        for (let level = pending.pop(); level; level = pending.pop()) {
          const leaves: Array<{ entry: Entry; archive: boolean }> = []
          for (const entry of level.entries) {
            await breathe()
            if (entry.kind !== 'dir') { leaves.push({ entry, archive: false }); continue }
            await attempt(entry.rel, async () => {
              await copyEntry(fs, source, destination, entry, sourceOverrides)
              onLine(`  ${entry.rel}/`)
            })
            const key = childOf(level.key, entry.rel.split('/').pop()!.normalize('NFC'))
            const children = await list(source, entry.rel, key, true, true)
            if (children?.size) pending.push({ entries: [...children.values()], key })
          }
          await copyLeaves(leaves)
        }
      }

      await walk<DirPair>(walkEverything ? [{ key: '', src: '', dest: '' }] : changedDirs, walkEverything ? 1 : 2, async (dir, push) => {
        const sourceEntries = await list(source, dir.src!, dir.key, true, true)
        const destEntries = sourceEntries && await list(destination, dir.dest!, dir.key, true, false)
        if (!sourceEntries || !destEntries) return
        // Deletes first: a path that changed kind must vacate before its new form arrives.
        for (const [name, existing] of destEntries) {
          const entry = sourceEntries.get(name)
          if (!entry || entry.kind !== existing.kind) await removeFromDestination(existing, childOf(dir.key, name))
        }
        const creates: Entry[] = []
        const updates: Array<{ entry: Entry; destRel: string; archive: boolean }> = []
        for (const [name, entry] of sourceEntries) {
          await breathe()
          const existing = destEntries.get(name)
          if (!existing || existing.kind !== entry.kind) creates.push(entry)
          else if (differs(entry, existing)) updates.push({ entry, destRel: existing.rel, archive: true })
          else if (walkEverything && entry.kind === 'dir') push({ key: childOf(dir.key, name), src: entry.rel, dest: existing.rel })
        }
        await createAll(creates, dir.key)
        await copyLeaves(updates)
      })

      fs.assertActive()
      onProgress({ percent: 100, files: { ...files }, bytes: { ...bytes } })
      const counts = { archived, copied, bytes: copiedBytes }
      if (failed) {
        return { ok: false, ...counts, ...plan, errors, message: t('backend.itemsFailed', { count: failed, error: errors[0] }) }
      }
      return { ok: true, ...counts, ...plan, errors }
    } catch (error) {
      if (!(error instanceof MirrorCancelled)) throw error
      return { ok: false, cancelled: true, archived, copied, bytes: copiedBytes, ...plan, errors, message: error.message }
    }
  }
}
