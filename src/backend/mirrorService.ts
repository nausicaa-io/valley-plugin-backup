import { t } from './localization'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from './path'
import type { MirrorTick } from './mirror'
import type {
  MirrorIssue,
  MirrorMapping,
  MirrorPlan,
  MirrorMappingResult,
  MirrorPreflight,
  MirrorProgressUpdate,
  MirrorResult
} from '../types'
const pad2 = (value: number): string => String(value).padStart(2, '0')
const localDateKey = (value: Date): string => `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
import {
  CACHE_DIR,
  PLUGIN_CACHE_DATABASE,
  PLUGIN_DATA_DIR,
  PLUGIN_DURABLE_DATABASE
} from '@valley/plugin-sdk/paths'
import { createMirrorEngine } from './mirror'
import { MirrorCancelled } from './jobLifetime'
import type { StorageSession } from './storageFs'
import { ARCHIVE_DIR, createArchiveRetention } from './retention'
export { ARCHIVE_DIR, planMirrorRetention, type RetentionPlan, type PruneResult } from './retention'

const mirrorExcludes = (exclude: readonly string[]): string[] => [
  ...exclude,
  `${ARCHIVE_DIR}/`,
  `${CACHE_DIR}/`,
  `${CACHE_DIR}/*`,
  `${PLUGIN_DATA_DIR}/*/${PLUGIN_DURABLE_DATABASE}`,
  `${PLUGIN_DATA_DIR}/*/${PLUGIN_DURABLE_DATABASE}-wal`,
  `${PLUGIN_DATA_DIR}/*/${PLUGIN_DURABLE_DATABASE}-shm`,
  `${PLUGIN_DATA_DIR}/*/${PLUGIN_CACHE_DATABASE}`,
  `${PLUGIN_DATA_DIR}/*/${PLUGIN_CACHE_DATABASE}-wal`,
  `${PLUGIN_DATA_DIR}/*/${PLUGIN_CACHE_DATABASE}-shm`,
  `${PLUGIN_DATA_DIR}/*/cache/`,
  `${PLUGIN_DATA_DIR}/*/cache/*`
]
/** Seconds left given how long the transfer has run and how far along it is. */
export function computeEtaSeconds(elapsedMs: number, percent: number): number | null {
  if (percent <= 0 || percent >= 100 || elapsedMs <= 0) return null
  return Math.round((elapsedMs / 1000) * ((100 - percent) / percent))
}

/** Timestamp matching the script's `%Y-%m-%d_%H-%M-%S` trash-dir naming. */
export function mirrorTimestamp(date = new Date()): string {
  return (
    `${localDateKey(date)}` +
    `_${pad2(date.getHours())}-${pad2(date.getMinutes())}-${pad2(date.getSeconds())}`
  )
}

/** `path` relative to `root` when it lies strictly inside it, else null. */
function insideRel(root: string, path: string): string | null {
  const rel = relative(resolve(root), resolve(path))
  if (!rel || rel === '..' || rel.startsWith('../') || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null
  return rel
}

const samePath = (a: string, b: string): boolean => normalize(a).toLowerCase() === normalize(b).toLowerCase()
const nested = (outer: string, inner: string): boolean => normalize(inner).toLowerCase().startsWith(normalize(outer).toLowerCase().replace(/\/$/, '') + '/')

/**
 * The mapping as a run or restore sees it: the plan's own archive folder, log
 * folder and master log are excluded wherever they sit inside the source or
 * the destination, so a run never backs up, deletes or escrows its own output.
 */
export function planMapping(plan: MirrorPlan, mapping: MirrorMapping): MirrorMapping {
  const extra: string[] = []
  const owned: Array<[string, boolean]> = [[plan.trashPath, true], [plan.logDirectory, true], [plan.masterLog, false]]
  for (const [path, directory] of owned) {
    if (!path) continue
    for (const root of [mapping.source, mapping.destination]) {
      const rel = insideRel(root, path)
      if (rel && !extra.includes(directory ? `${rel}/` : rel)) extra.push(directory ? `${rel}/` : rel)
    }
  }
  return extra.length ? { ...mapping, exclude: [...mapping.exclude, ...extra] } : mapping
}

// ---- Archive retention -----------------------------------------------------

export interface RestoreChanges {
  creates: string[]
  updates: string[]
  deletes: string[]
}

export interface RestoreOutcome extends RestoreChanges {
  cancelled?: boolean
  ok: boolean
  message?: string
  skipped?: string[]
}

/**
 * The removable-volume mount point a path lives on, or null when the path is on
 * the system volume (whose missing directories we can always create).
 *
 * - macOS mounts under `/Volumes/<name>`.
 * - Linux desktops use `/media/<user>/<label>`, `/run/media/<user>/<label>` or
 *   a hand-mounted `/mnt/<name>`.
 * - Windows gives a removable drive its own root, so the drive *is* the mount
 *   point — `E:\Backup\x` → `E:\`. `C:` is excluded: it is the system volume,
 *   always present, and treating it as removable would make every ordinary
 *   local destination look like a mount to check.
 */
export function volumeRoot(p: string): string | null {
  const windowsDrive = /^([a-zA-Z]):[\\/]/.exec(p)
  if (windowsDrive) {
    const letter = windowsDrive[1].toUpperCase()
    return letter === 'C' ? null : `${letter}:${sep}`
  }
  const mac = /^(\/Volumes\/[^/]+)/.exec(p)
  if (mac) return mac[1]
  const linux = /^(\/(?:run\/)?media\/[^/]+\/[^/]+)/.exec(p)
  if (linux) return linux[1]
  const mnt = /^(\/mnt\/[^/]+)/.exec(p)
  return mnt ? mnt[1] : null
}

export function createMirrorService(storage: Pick<StorageSession, 'fs' | 'prepareStorageSnapshots' | 'releaseStorageSnapshot' | 'assertActive' | 'restoreExclusions' | 'restoreDatasets'>) {
  const { fs, prepareStorageSnapshots, releaseStorageSnapshot } = storage
  const mirrorTree = createMirrorEngine(fs)
  const pruneMirrorArchives = createArchiveRetention(storage)

  // ---- Restore (reverse mirror with preview) --------------------------------

  /** Run one reverse mirror (preview when `dryRun`). Every log line goes to
   *  `onLine`; the change buckets come back for the confirm UI. */
  async function runRestore(
    mapping: MirrorMapping,
    opts: { dryRun: boolean; escrowDir?: string },
    onLine: (line: string) => void = () => {}
  ): Promise<RestoreOutcome> {
    const snapshots = await prepareStorageSnapshots([mapping.source])
    try {
      const excluded = storage.restoreExclusions(mapping)
      const datasets = await storage.restoreDatasets(mapping, true)
      // Reverse of the backup direction: destination → source. Excludes stay
      // applied so the delete side can never remove files the backup skipped,
      // and the destination's archive folder never lands in the source.
      const outcome = await mirrorTree(
        {
          source: mapping.destination,
          destination: mapping.source,
          exclude: mirrorExcludes([...withSnapshotExcludes(mapping, snapshots.excluded).exclude, ...excluded]),
          backupDir: opts.dryRun ? undefined : opts.escrowDir,
          dryRun: opts.dryRun
        },
        onLine
      )
      const restored = outcome.ok && !opts.dryRun ? await storage.restoreDatasets(mapping, false) : datasets
      return {
        ok: outcome.ok,
        ...(outcome.cancelled ? { cancelled: true } : {}),
        creates: outcome.creates,
        updates: [...outcome.updates, ...(outcome.ok ? restored.stores.map(store => store.path) : [])],
        deletes: outcome.deletes,
        skipped: [...excluded, ...restored.skipped],
        message: outcome.message
      }
    } finally { if (snapshots.stagingRoot) await releaseStorageSnapshot(snapshots.stagingRoot) }
  }

  // ---- Pre-flight validation -------------------------------------------------

  async function exists(p: string): Promise<boolean> {
    try {
      await fs.access(p)
      return true
    } catch {
      storage.assertActive()
      return false
    }
  }

  /**
   * Validate that a plan can run *before* mirroring anything: every source must
   * exist, every destination's drive must be mounted (a missing sub-directory on
   * a mounted drive is fine — it gets created), and no folder may contain its
   * own mirror. Returns the blocking issues (empty = good to go).
   *
   * The drive check is what makes "you forgot to plug the drive in" a blocked
   * run with a clear message instead of a silent success: without it the run
   * `mkdir -p`s the whole destination onto the internal disk, producing an empty
   * stub that looks like a backup (see {@link volumeRoot}).
   */
  async function preflightMirror(plan: MirrorPlan): Promise<MirrorIssue[]> {
    const issues: MirrorIssue[] = []
    if (plan.mappings.length === 0) {
      issues.push({ kind: 'no-mappings', message: t('backend.emptyPlan') })
      return issues
    }
    for (let i = 0; i < plan.mappings.length; i++) {
      storage.assertActive()
      const m = plan.mappings[i]
      const folder = basename(m.source.replace(/\/$/, '')) || m.source
      const base = { mappingIndex: i + 1, folder, source: m.source, destination: m.destination }
      // A destination inside its source is backed up into itself on every run;
      // a source inside its destination is swept away as stale content.
      if (samePath(m.source, m.destination) || nested(m.source, m.destination) || nested(m.destination, m.source)) {
        issues.push({ ...base, kind: 'overlap', message: t('backend.overlap', { source: m.source, destination: m.destination }) })
        continue
      }
      if (plan.trashPath && (samePath(plan.trashPath, m.source) || samePath(plan.trashPath, m.destination))) {
        issues.push({ ...base, kind: 'overlap', message: t('backend.archiveOverlap', { path: plan.trashPath }) })
        continue
      }
      if (!(await exists(m.source))) {
        issues.push({ ...base, kind: 'source-missing', message: t('backend.sourceMissing', { path: m.source }) })
      }
      const root = volumeRoot(m.destination)
      if (root && !(await exists(root))) {
        issues.push({
          ...base,
          kind: 'drive-not-mounted',
          driveRoot: root,
          message: t('backend.driveMissing', { name: basename(root), path: root })
        })
      }
    }
    return issues
  }

  async function checkMirror(plan: MirrorPlan): Promise<MirrorPreflight> {
    const issues = await preflightMirror(plan)
    return { ok: issues.length === 0, issues }
  }

  // ---- Runner ---------------------------------------------------------------

  let running = false

  /** Outcome of one mapping: what was actually written and archived, plus a
   *  reason if anything failed. */
  interface MappingOutcome {
    cancelled?: boolean
    archived: number
    copied: number
    bytes: number
    /** Individual entries the engine could not handle. */
    failedItems: number
    error?: string
  }

  function withSnapshotExcludes(mapping: MirrorMapping, excluded: readonly string[] = []): MirrorMapping {
    const source = resolve(mapping.source)
    const patterns = excluded.flatMap((original) => {
      const rel = relative(source, original)
      if (rel === '..' || rel.startsWith(`..${sep}`) || /^[A-Za-z]:/.test(rel) || rel.startsWith('/')) return []
      return [rel ? rel.split(sep).join('/') + (original.endsWith('/') ? '/' : '') : '*']
    })
    return { ...mapping, exclude: [...mapping.exclude, ...patterns] }
  }

  function mappingOverrides(mapping: MirrorMapping, snapshots: ReadonlyMap<string, string>): Map<string, string> {
    const source = resolve(mapping.source)
    const overrides = new Map<string, string>()
    for (const [original, staged] of snapshots) {
      const rel = relative(source, original)
      if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) continue
      overrides.set(rel.split(sep).join('/'), staged)
    }
    return overrides
  }

  /** Mirror one mapping. Log lines go to `onLine`; progress ticks to `onTick`
   *  (throttled inside the engine). What was archived and copied is real work
   *  whether or not some other entry failed, so it is reported either way —
   *  plus `error` when the engine could not handle everything. */
  async function runMapping(
    mapping: MirrorMapping,
    backupDir: string,
    sourceOverrides: ReadonlyMap<string, string>,
    onLine: (line: string) => void,
    onTick: (tick: MirrorTick) => void
  ): Promise<MappingOutcome> {
    const outcome = await mirrorTree(
      {
        source: mapping.source,
        destination: mapping.destination,
        exclude: mirrorExcludes(mapping.exclude),
        backupDir,
        sourceOverrides
      },
      onLine,
      onTick
    )
    const counts = { archived: outcome.archived, copied: outcome.copied, bytes: outcome.bytes }
    if (!outcome.ok) {
      return {
        cancelled: outcome.cancelled,
        ...counts,
        failedItems: outcome.errors.length,
        error: outcome.message ?? t('backend.mirrorFailed')
      }
    }
    return { ...counts, failedItems: 0 }
  }

  /**
   * Append the run's lines to `<logDirectory>/<ts>.log` in bounded chunks, so a
   * run over a huge tree neither holds its whole log in memory nor exceeds the
   * storage write limit. Logging is best-effort: a failing log drive never
   * fails the backup.
   */
  function createSessionLog(logDirectory: string, ts: string) {
    const path = logDirectory ? join(logDirectory, `${ts}.log`) : ''
    let buffer: string[] = []
    let failed = !path
    let writing: Promise<void> = path
      ? fs.mkdir(logDirectory, { recursive: true }).catch(() => { failed = true })
      : Promise.resolve()
    const flush = (): Promise<void> => {
      if (failed || !buffer.length) { buffer = []; return writing }
      const chunk = `${buffer.join('\n')}\n`
      buffer = []
      writing = writing.then(() => failed ? undefined : fs.appendFile(path, chunk)).catch(() => { failed = true })
      return writing
    }
    return {
      push(line: string): void {
        if (failed) return
        buffer.push(line)
        if (buffer.length >= 500) void flush()
      },
      close: flush
    }
  }

  /**
   * Run the full mirror operation: accept a plan, mirror every mapping, prune
   * old archives, and append a one-line summary to the master log. Streams log
   * output through `onLine` and per-mapping progress through `onProgress`.
   * Single-flight (see the running guard).
   */
  async function runMirror(
    config: MirrorPlan,
    onLine: (line: string) => void,
    onProgress: (update: MirrorProgressUpdate) => void = () => {},
    onMapping: (mapping: MirrorMappingResult) => void = () => {}
  ): Promise<MirrorResult> {
    if (running) {
      return { ok: false, mappings: 0, archived: 0, durationSec: 0, errors: 0, message: t('backend.mirrorRunning') }
    }
    running = true
    const started = Date.now()
    let sessionLog: ReturnType<typeof createSessionLog> | null = null
    const emitLine = (line: string): void => {
      sessionLog?.push(line)
      onLine(line)
    }
    let stagingRoot: string | null = null
    let archived = 0
    let copied = 0
    let bytes = 0
    let errors = 0
    let failedItems = 0
    const totals = () => ({ archived, copied, bytes, errors, failedItems })
    try {
      storage.assertActive()
      if (config.mappings.length === 0) {
        emitLine(t('backend.noFoldersLog'))
        return {
          ok: false,
          mappings: 0,
          archived: 0,
          durationSec: 0,
          errors: 0,
          message: t('backend.noFolders'),
          issues: [{ kind: 'no-mappings', message: t('backend.noFolders') }]
        }
      }

      // Pre-flight: abort cleanly if a drive unmounted / a source vanished between
      // the panel's check and now — no raw engine spam, a clear reason instead.
      const issues = await preflightMirror(config)
      if (issues.length > 0) {
        const drive = issues.find((i) => i.kind === 'drive-not-mounted')
        return {
          ok: false,
          mappings: config.mappings.length,
          archived: 0,
          durationSec: 0,
          errors: issues.length,
          message: drive ? drive.message : issues[0].message,
          issues
        }
      }

      const ts = mirrorTimestamp(new Date(started))
      sessionLog = createSessionLog(config.logDirectory, ts)
      const snapshots = await prepareStorageSnapshots(config.mappings.map((mapping) => mapping.source))
      stagingRoot = snapshots.stagingRoot
      const mappingCount = config.mappings.length

      // `errors` counts folders, `failedItems` counts entries — a folder can fail
      // over thousands of them, and only the second number says so.

      emitLine(t('backend.started', { time: ts, label: config.label }))
      for (let mi = 0; mi < config.mappings.length; mi++) {
        storage.assertActive()
        const mapping = withSnapshotExcludes(planMapping(config, config.mappings[mi]), snapshots.excluded)
        const folder = basename(mapping.source.replace(/\/$/, ''))
        const mappingBase = { index: mi + 1, folder, source: mapping.source, destination: mapping.destination }
        onMapping({ ...mappingBase, status: 'running' })
        try {
          await fs.access(mapping.source)
        } catch {
          storage.assertActive()
          emitLine(t('backend.sourceMissingLog', { path: mapping.source }))
          onMapping({ ...mappingBase, status: 'skipped', message: t('backend.sourceMissingShort') })
          errors++
          continue
        }
        try {
          await fs.mkdir(mapping.destination, { recursive: true })
        } catch {
          storage.assertActive()
          emitLine(t('backend.destinationMissingLog', { path: mapping.destination }))
          onMapping({ ...mappingBase, status: 'skipped', message: t('backend.destinationMissing') })
          errors++
          continue
        }

        const backupDir = config.trashPath ? join(config.trashPath, ts, folder) : join(mapping.destination, ARCHIVE_DIR, ts)
        emitLine(t('backend.syncing', { folder }))

        const base = { folder, mappingIndex: mi + 1, mappingCount }
        // Until the engine emits its first tick it's scanning both trees.
        onProgress({ ...base, percent: 0, etaSeconds: null, phase: 'scanning' })
        let transferStart = 0
        const outcome = await runMapping(mapping, backupDir, mappingOverrides(mapping, snapshots.files), emitLine, (tick) => {
          if (transferStart === 0) transferStart = Date.now()
          onProgress({
            ...base,
            percent: tick.percent,
            etaSeconds: computeEtaSeconds(Date.now() - transferStart, tick.percent),
            phase: 'transferring',
            files: tick.files,
            bytes: tick.bytes
          })
        })
        archived += outcome.archived
        copied += outcome.copied
        bytes += outcome.bytes
        failedItems += outcome.failedItems
        if (outcome.cancelled) throw new MirrorCancelled()
        if (outcome.error) {
          // Whatever the engine did manage still counts — the run is reported as
          // failed, but the files it copied and archived are not disowned.
          emitLine(t('backend.failedLog', { folder, error: outcome.error }))
          onMapping({
            ...mappingBase,
            status: 'failed',
            archived: outcome.archived,
            failedItems: outcome.failedItems,
            message: outcome.error
          })
          errors++
          continue
        }
        onMapping({ ...mappingBase, status: 'done', archived: outcome.archived })
        emitLine(t('backend.mappingDone', { folder, copied: outcome.copied, archived: outcome.archived }))
      }

      // Drop an empty timestamp trash dir (nothing was archived this run).
      if (config.trashPath) {
        const tsDir = join(config.trashPath, ts)
        try {
          if ((await fs.readdir(tsDir)).length === 0) await fs.rmdir(tsDir)
        } catch {
          storage.assertActive()
          // dir absent or non-empty — leave it
        }
      }

      // Retention: prune old timestamped archives after a successful run.
      storage.assertActive()
      if (config.retention !== null && errors === 0) {
        const pruned = await pruneMirrorArchives(config)
        if (pruned.cancelled) throw new MirrorCancelled()
        if (pruned.dropped.length || pruned.errors.length) {
          emitLine(
            t('backend.retention', { kept: pruned.kept, count: pruned.dropped.length }) +
              (pruned.errors.length ? t('backend.retentionFailures', { count: pruned.errors.length }) : '')
          )
        }
      }

      storage.assertActive()
      const durationSec = Math.round((Date.now() - started) / 1000)
      emitLine(
        t('backend.complete', { seconds: durationSec, copied, archived, errors }) +
          (failedItems ? t('backend.failedCount', { count: failedItems }) : '')
      )
      const logs = await Promise.allSettled([
        sessionLog.close(),
        appendMasterLog(config.masterLog, ts, durationSec, copied, archived, errors)
      ])
      const failure = logs.find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason

      return {
        ok: errors === 0,
        mappings: config.mappings.length,
        ...totals(),
        durationSec
      }
    } catch (error) {
      if (!(error instanceof MirrorCancelled)) throw error
      return { ok: false, cancelled: true, mappings: config.mappings.length, ...totals(), durationSec: Math.round((Date.now() - started) / 1000), message: error.message }
    } finally {
      if (stagingRoot) await releaseStorageSnapshot(stagingRoot).catch(() => undefined)
      running = false
    }
  }

  async function appendMasterLog(
    masterLog: string,
    ts: string,
    durationSec: number,
    copied: number,
    archived: number,
    errors: number
  ): Promise<void> {
    if (!masterLog) return
    try {
      await fs.mkdir(dirname(masterLog), { recursive: true })
      const line = `${ts} [INFO] duration=${durationSec}s copied=${copied} archived=${archived} errors=${errors}\n`
      await fs.appendFile(masterLog, line)
    } catch {
      storage.assertActive()
      // logging is best-effort
    }
  }

  return { pruneMirrorArchives, runRestore, preflightMirror, checkMirror, runMirror }
}
