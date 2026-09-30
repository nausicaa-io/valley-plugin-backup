import { t } from './localization'
import { dirname, join, relative, sep } from './path'
import type { StorageFs, StorageDirent } from './storageFs'
import { MirrorCancelled } from './jobLifetime'

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
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(text)
}

/** Whether a source-relative path is excluded. Trailing-slash form matches dirs. */
export function isExcluded(relPath: string, excludes: readonly string[]): boolean {
  return excludes.some((p) => globMatch(relPath, p) || globMatch(`${relPath}/`, p))
}

/** One entry of a scanned tree, keyed by POSIX-style relative path. */
interface Entry {
  kind: 'file' | 'dir' | 'symlink'
  size: number
  mtimeMs: number
  /** Link target, for symlinks. */
  target?: string
}

function toRel(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/')
}

/**
 * Walk a tree into a `relPath → Entry` map. Excluded paths are skipped, and an
 * excluded directory is not descended into. A missing root yields an empty map
 * — the caller (preflight) is what decides whether that is an error.
 *
 * `onExcluded` reports every path that was skipped. The delete side needs it:
 * an excluded file is absent from the map, so the directory holding it looks
 * empty-of-survivors and would be swept away with it.
 */
async function scanTree(
  fs: StorageFs,
  root: string,
  excludes: readonly string[],
  onExcluded: (rel: string) => void = () => {}
): Promise<Map<string, Entry>> {
  const out = new Map<string, Entry>()

  async function walk(absDir: string): Promise<void> {
    let entries: StorageDirent[]
    try {
      entries = await fs.readdir(absDir, { withFileTypes: true })
    } catch (error) {
      if (error instanceof MirrorCancelled) throw error
      return
    }
    for (const dirent of entries) {
      fs.assertActive()
      const abs = join(absDir, dirent.name)
      const rel = toRel(root, abs)
      if (!rel) continue
      if (isExcluded(rel, excludes)) {
        onExcluded(rel)
        continue
      }
      // Listing entries are lstat results: a symlink is mirrored as a link, not
      // as the file it points at — following them would copy a tree twice, or forever.
      if (dirent.isSymbolicLink()) {
        const target = await fs.readlink(abs).catch((error) => { if (error instanceof MirrorCancelled) throw error; return null })
        if (target === null) continue
        out.set(rel, { kind: 'symlink', size: 0, mtimeMs: dirent.mtimeMs, target })
        continue
      }
      if (dirent.isDirectory()) {
        out.set(rel, { kind: 'dir', size: 0, mtimeMs: dirent.mtimeMs })
        await walk(abs)
        continue
      }
      if (dirent.isFile()) out.set(rel, { kind: 'file', size: dirent.size, mtimeMs: dirent.mtimeMs })
    }
  }

  await walk(root)
  return out
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

/**
 * Compare two scanned trees. Pure — this is the half worth unit-testing, and it
 * is what the dry-run preview reports.
 *
 * Deletion candidates are filtered by the same excludes as the copy side: a
 * destination file that the source *would* have, but which the user excluded,
 * must not be swept away.
 */
export function planMirror(
  source: Map<string, Entry>,
  dest: Map<string, Entry>,
  excludes: readonly string[]
): MirrorChanges {
  const creates: string[] = []
  const updates: string[] = []
  const deletes: string[] = []
  for (const [rel, entry] of source) {
    const existing = dest.get(rel)
    if (!existing) creates.push(rel)
    else if (existing.kind !== entry.kind) {
      // A path that changed kind has to vacate before its new children arrive,
      // so it is escrowed on the delete side and recreated on the create side.
      deletes.push(rel)
      creates.push(rel)
    } else if (differs(entry, existing)) updates.push(rel)
  }
  for (const rel of dest.keys()) {
    if (source.has(rel)) continue
    if (isExcluded(rel, excludes)) continue
    deletes.push(rel)
  }
  // Shallowest first for creates (parents before children), deepest first for
  // deletes (children before the dir that holds them).
  creates.sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  deletes.sort((a, b) => b.split('/').length - a.split('/').length || a.localeCompare(b))
  return { creates, updates: updates.sort(), deletes }
}

/** One destination path removed as a unit, and how much of the plan it covers. */
export interface DeletionRoot {
  /** Destination-relative path removed (or escrowed) in one operation. */
  rel: string
  /** Plan entries this removal accounts for — itself plus everything under it. */
  entries: number
}

/** `a/b/c` → `['a', 'a/b']`, shallowest first. */
function ancestorsOf(rel: string): string[] {
  const parts = rel.split('/')
  const out: string[] = []
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(0, i).join('/'))
  return out
}

/**
 * Reduce a deletion list to the entries that are actually removed on disk.
 *
 * `planMirror` names a doomed directory *and*, separately, every descendant of
 * it, and the escrow moves them deepest-first — so `dir/child` is renamed into
 * `backupDir/dir/child`, whose `mkdir -p` creates `backupDir/dir`, and the
 * rename of `dir` itself then lands on a directory that is no longer empty.
 * `rename(2)` refuses that with ENOTEMPTY. Measured on a real run: 6515 of 6515
 * errors were exactly that — every file moved, every parent directory failed,
 * the destination kept the whole tree, and the next run planned and failed the
 * identical deletions. One directory level peeled per run, forever.
 *
 * So a doomed directory is moved with ONE rename, and only when its whole
 * subtree is doomed. A directory still holding something the plan keeps (an
 * excluded file) is not removed at all: moving it would take that file along,
 * which is the one thing the excludes exist to prevent.
 */
export function deletionRoots(
  deletes: readonly string[],
  destPaths: Iterable<string>
): DeletionRoot[] {
  const doomed = new Set(deletes)
  // Anything the plan keeps pins every directory above it — a pinned directory
  // has to survive, so it can never be moved as a unit.
  const pinned = new Set<string>()
  for (const rel of destPaths) {
    if (doomed.has(rel)) continue
    for (const ancestor of ancestorsOf(rel)) pinned.add(ancestor)
  }
  /** The shallowest doomed, unpinned ancestor — the entry that takes `rel` with it. */
  const coveredBy = (rel: string): string | null => {
    for (const ancestor of ancestorsOf(rel)) {
      if (doomed.has(ancestor) && !pinned.has(ancestor)) return ancestor
    }
    return null
  }

  const roots = new Map<string, DeletionRoot>()
  for (const rel of deletes) {
    if (pinned.has(rel) || coveredBy(rel)) continue
    roots.set(rel, { rel, entries: 1 })
  }
  for (const rel of deletes) {
    if (roots.has(rel) || pinned.has(rel)) continue
    // Nothing survives below a doomed, unpinned directory, so the ancestor
    // `coveredBy` returns is itself uncovered — i.e. always one of the roots.
    const root = coveredBy(rel)
    if (root) roots.get(root)!.entries++
  }
  // Shallowest first. The roots are pairwise non-nested, so the order is free.
  return [...roots.values()].sort(
    (a, b) => a.rel.split('/').length - b.rel.split('/').length || a.rel.localeCompare(b.rel)
  )
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
 */
async function copyEntry(
  fs: StorageFs,
  sourceRoot: string,
  destRoot: string,
  rel: string,
  entry: Entry,
  sourceOverrides?: ReadonlyMap<string, string>
): Promise<void> {
  const from = sourceOverrides?.get(rel) ?? join(sourceRoot, ...rel.split('/'))
  const to = join(destRoot, ...rel.split('/'))
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
  await fs.copyFile(from, to)
  // rsync -a preserves times, and the next run's quick check depends on it. The
  // copy itself already landed, so a stamp lost to cancellation only means the
  // next run copies this file once more; it must not disown the copy.
  try {
    await fs.utimes(to, new Date(), new Date(entry.mtimeMs))
  } catch {
    // best-effort stamp
  }
}

/** How much one planned entry weighs against copied bytes in the progress bar. */
const ENTRY_WEIGHT = 64 * 1024
/** Copies and updates in flight at once; directories and deletes stay sequential. */
const COPY_WORKERS = 4

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

/**
 * Mirror `source` into `destination`. Emits one log line per action through
 * `onLine` and throttled progress — percent weighted by bytes, plus entry and
 * byte counters — through `onProgress`.
 */
export function createMirrorEngine(fs: StorageFs) {
  return async function mirrorTree(
    opts: MirrorOptions,
    onLine: (line: string) => void = () => {},
    onProgress: (progress: MirrorTick) => void = () => {}
  ): Promise<MirrorOutcome> {
    const { source, destination, backupDir, dryRun = false } = opts
    const exclude = [...opts.exclude]
    const sourceOverrides = opts.sourceOverrides ? new Map(opts.sourceOverrides) : undefined
    let archived = 0
    let copied = 0
    let copiedBytes = 0
    let plan: MirrorChanges = { creates: [], updates: [], deletes: [] }
    const errors: string[] = []
    const empty = { archived: 0, copied: 0, bytes: 0, creates: [], updates: [], deletes: [] }
    try {
      fs.assertActive()
      let sourceTree: Map<string, Entry>
      try {
        const stat = await fs.stat(source)
        if (!stat.isDirectory()) {
          const message = t('backend.sourceNotFolder', { path: source })
          return { ok: false, ...empty, errors: [message], message }
        }
        sourceTree = await scanTree(fs, source, exclude)
        for (const [rel, staged] of sourceOverrides ?? []) {
          const stat = await fs.lstat(staged)
          if (!stat.isFile()) throw new Error(t('backend.stagedNotFile', { path: rel }))
          const parts = rel.split('/')
          for (let index = 1; index < parts.length; index++) {
            const parent = parts.slice(0, index).join('/')
            if (!sourceTree.has(parent)) sourceTree.set(parent, { kind: 'dir', size: 0, mtimeMs: stat.mtimeMs })
          }
          sourceTree.set(rel, { kind: 'file', size: stat.size, mtimeMs: stat.mtimeMs })
        }
      } catch (error) {
        if (error instanceof MirrorCancelled) throw error
        const message = t('backend.sourceUnavailable', { path: source })
        return { ok: false, ...empty, errors: [message], message }
      }
      // Excluded destination paths never enter the tree, so the delete side has to
      // be told about them separately or a directory whose only remaining content is
      // excluded gets moved into the escrow along with it.
      const excludedInDest = new Set<string>()
      const destTree = await scanTree(fs, destination, exclude, (rel) => excludedInDest.add(rel))
      fs.assertActive()
      plan = planMirror(sourceTree, destTree, exclude)

      if (dryRun) return { ok: true, archived: 0, copied: 0, bytes: 0, errors: [], ...plan }

      const sizeOf = (rel: string): number => {
        const entry = sourceTree.get(rel)
        return entry?.kind === 'file' ? entry.size : 0
      }
      const files = { done: 0, total: plan.creates.length + plan.updates.length + plan.deletes.length }
      const bytes = { done: 0, total: 0 }
      for (const rel of [...plan.creates, ...plan.updates]) bytes.total += sizeOf(rel)
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
          errors.push(message)
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
      // Deletes first: a path that changed kind must vacate before the create
      // side puts the other kind there. One operation per `deletionRoots` entry —
      // a doomed directory goes as a unit, which is both what makes the escrow
      // possible at all and one rename instead of thousands.
      for (const root of deletionRoots(plan.deletes, [...destTree.keys(), ...excludedInDest])) {
        const from = join(destination, ...root.rel.split('/'))
        await attempt(
          root.rel,
          async () => {
            if (backupDir) {
              await escrow(fs, destination, backupDir, root.rel, escrowDirs)
              archived += root.entries
              onLine(t('backend.archiveLine', { path: root.rel }))
            } else {
              await fs.rm(from, { recursive: true, force: true })
            }
            onLine(t('backend.deleteLine', { path: root.rel }))
          },
          root.entries
        )
      }
      // Directories in plan order (parents first), then every file and link
      // through a small worker pool — their parents all exist by then.
      const createDir = (rel: string): boolean => sourceTree.get(rel)!.kind === 'dir'
      for (const rel of plan.creates.filter(createDir)) {
        await attempt(rel, async () => {
          await copyEntry(fs, source, destination, rel, sourceTree.get(rel)!, sourceOverrides)
          onLine(`  ${rel}/`)
        })
      }
      await pool(plan.creates.filter((rel) => !createDir(rel)), COPY_WORKERS, (rel) =>
        attempt(rel, async () => {
          await copyEntry(fs, source, destination, rel, sourceTree.get(rel)!, sourceOverrides)
          copied++
          copiedBytes += sizeOf(rel)
          onLine(`  ${rel}`)
        }, 1, sizeOf(rel))
      )
      await pool(plan.updates, COPY_WORKERS, (rel) =>
        attempt(rel, async () => {
          if (backupDir) {
            await escrow(fs, destination, backupDir, rel, escrowDirs)
            archived++
            onLine(t('backend.archiveLine', { path: rel }))
          }
          await copyEntry(fs, source, destination, rel, sourceTree.get(rel)!, sourceOverrides)
          copied++
          copiedBytes += sizeOf(rel)
          onLine(`  ${rel}`)
        }, 1, sizeOf(rel))
      )

      fs.assertActive()
      onProgress({ percent: 100, files: { ...files }, bytes: { ...bytes } })
      const counts = { archived, copied, bytes: copiedBytes }
      if (errors.length) {
        return { ok: false, ...counts, ...plan, errors, message: t('backend.itemsFailed', { count: errors.length, error: errors[0] }) }
      }
      return { ok: true, ...counts, ...plan, errors }
    } catch (error) {
      if (!(error instanceof MirrorCancelled)) throw error
      return { ok: false, cancelled: true, archived, copied, bytes: copiedBytes, ...plan, errors, message: error.message }
    }
  }
}
