import { t } from './localization'
import { basename, dirname, join, relative, resolve, sep } from './path'
import type {
  MirrorIssue,
  MirrorMapping,
  MirrorPlan,
  MirrorRetentionPolicy,
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
import { isExcluded, mirrorTree } from './mirror'
import { storageFs as fs, type StorageDirent, prepareStorageSnapshots, releaseStorageSnapshot } from './storageFs'

const mirrorExcludes = (exclude: readonly string[]): string[] => [
  ...exclude,
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

// ---- Archive retention -----------------------------------------------------

/** Strictly timestamp-shaped names are retention candidates — nothing else in
 *  a trash folder can ever be deleted by the pruner. */
const ARCHIVE_NAME = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/

function parseArchiveName(name: string): Date | null {
  if (!ARCHIVE_NAME.test(name)) return null
  const [d, t] = name.split('_')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi, s] = t.split('-').map(Number)
  const date = new Date(y, mo - 1, da, h, mi, s)
  return Number.isNaN(date.getTime()) ? null : date
}

function isoWeekKey(date: Date): string {
  // ISO week: Thursday of the same week determines year + week number.
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
  d.setDate(d.getDate() - day + 3)
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  const firstDay = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3)
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface RetentionPlan {
  keep: string[]
  drop: string[]
}

/**
 * Day/week retention over timestamped archive dirs: keep everything younger
 * than `keepDays`, then the newest per calendar day up to `dailies` days, then
 * the newest per ISO week up to `weeklies` weeks; older archives drop. Names
 * that aren't timestamp-shaped are never candidates (returned in neither list).
 */
export function planMirrorRetention(
  dirNames: readonly string[],
  now: Date,
  opts: MirrorRetentionPolicy
): RetentionPlan {
  const keepDays = opts.keepDays
  const dailies = opts.dailies
  const weeklies = opts.weeklies
  const dayMs = 24 * 3600 * 1000

  const stamped = dirNames
    .map((name) => ({ name, date: parseArchiveName(name) }))
    .filter((e): e is { name: string; date: Date } => e.date !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  const keep = new Set<string>()
  const dailySeen = new Set<string>()
  const weeklySeen = new Set<string>()
  for (const { name, date } of stamped) {
    const ageDays = (now.getTime() - date.getTime()) / dayMs
    if (ageDays <= keepDays) {
      keep.add(name)
      continue
    }
    if (ageDays <= dailies) {
      // Daily tier: newest per calendar day survives, siblings drop.
      const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
      if (!dailySeen.has(dayKey)) {
        dailySeen.add(dayKey)
        keep.add(name)
      }
      continue
    }
    if (ageDays <= weeklies * 7) {
      // Weekly tier (beyond the daily window): newest per ISO week survives.
      const weekKey = isoWeekKey(date)
      if (!weeklySeen.has(weekKey)) {
        weeklySeen.add(weekKey)
        keep.add(name)
      }
    }
  }
  return {
    keep: stamped.filter((e) => keep.has(e.name)).map((e) => e.name),
    drop: stamped.filter((e) => !keep.has(e.name)).map((e) => e.name)
  }
}

export interface PruneResult {
  scanned: number
  kept: number
  dropped: string[]
  errors: { dir: string; message: string }[]
}

/**
 * Apply {@link planMirrorRetention} to every archive location of a config:
 * the shared `trashPath` plus each destination's `.trash`. One failing dir is
 * recorded and the sweep continues — never a partial-delete inside one archive
 * (each timestamped dir is removed atomically-per-dir via `rm -r`).
 */
export async function pruneMirrorArchives(
  config: MirrorPlan,
  opts: { dryRun?: boolean; now?: Date } = {}
): Promise<PruneResult> {
  if (!config.retention) return { scanned: 0, kept: 0, dropped: [], errors: [] }
  const now = opts.now ?? new Date()
  const roots = new Set<string>()
  if (config.trashPath) roots.add(config.trashPath)
  for (const m of config.mappings) roots.add(join(m.destination, '.trash'))

  const result: PruneResult = { scanned: 0, kept: 0, dropped: [], errors: [] }
  for (const root of roots) {
    let names: string[]
    try {
      names = (await fs.readdir(root, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      continue // location absent (drive unplugged) — nothing to prune
    }
    const plan = planMirrorRetention(names, now, config.retention)
    result.scanned += plan.keep.length + plan.drop.length
    result.kept += plan.keep.length
    for (const name of plan.drop) {
      if (opts.dryRun) {
        result.dropped.push(join(root, name))
        continue
      }
      try {
        await fs.rm(join(root, name), { recursive: true })
        result.dropped.push(join(root, name))
      } catch (err) {
        result.errors.push({ dir: join(root, name), message: err instanceof Error ? err.message : String(err) })
      }
    }
  }
  return result
}

// ---- Restore (reverse mirror with preview) --------------------------------

export interface RestoreChanges {
  creates: string[]
  updates: string[]
  deletes: string[]
}

export interface RestoreOutcome extends RestoreChanges {
  ok: boolean
  message?: string
}

/** Run one reverse mirror (preview when `dryRun`). Every log line goes to
 *  `onLine`; the change buckets come back for the confirm UI. */
export async function runRestore(
  mapping: MirrorMapping,
  opts: { dryRun: boolean; escrowDir?: string },
  onLine: (line: string) => void = () => {}
): Promise<RestoreOutcome> {
  const snapshots = await prepareStorageSnapshots()
  try {
    // Reverse of the backup direction: destination → source. Excludes stay
    // applied so the delete side can never remove files the backup skipped.
    const outcome = await mirrorTree(
      {
        source: mapping.destination,
        destination: mapping.source,
        exclude: mirrorExcludes(withSnapshotExcludes(mapping, snapshots.excluded).exclude),
        backupDir: opts.dryRun ? undefined : opts.escrowDir,
        dryRun: opts.dryRun
      },
      onLine
    )
    return {
      ok: outcome.ok,
      creates: outcome.creates,
      updates: outcome.updates,
      deletes: outcome.deletes,
      message: outcome.message
    }
  } finally { if (snapshots.stagingRoot) await releaseStorageSnapshot(snapshots.stagingRoot) }
}

// ---- Pre-flight validation -------------------------------------------------

/**
 * The removable-volume mount point a path lives on, or null when the path is on
 * the system volume (whose missing directories we can always create).
 *
 * This is what makes "you forgot to plug the drive in" a blocked run with a
 * clear message instead of a silent success: with no mount point recognised,
 * preflight passes and the run then happily `mkdir -p`s the whole destination
 * onto the internal disk, producing an empty stub that looks like a backup.
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

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Validate that a plan can run *before* mirroring anything: every source must
 * exist and every destination's drive must be mounted (a missing sub-directory on
 * a mounted drive is fine — it gets created). Returns the blocking issues (empty =
 * good to go).
 */
export async function preflightMirror(plan: MirrorPlan): Promise<MirrorIssue[]> {
  const issues: MirrorIssue[] = []
  if (plan.mappings.length === 0) {
    issues.push({ kind: 'no-mappings', message: t('backend.emptyPlan') })
    return issues
  }
  for (let i = 0; i < plan.mappings.length; i++) {
    const m = plan.mappings[i]
    const folder = basename(m.source.replace(/\/$/, '')) || m.source
    const base = { mappingIndex: i + 1, folder, source: m.source, destination: m.destination }
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

export async function checkMirror(plan: MirrorPlan): Promise<MirrorPreflight> {
  const issues = await preflightMirror(plan)
  return { ok: issues.length === 0, issues }
}

// ---- Stale cleanup (ExFAT workaround) -------------------------------------

async function isDir(path: string): Promise<boolean> {
  try {
    return (await fs.lstat(path)).isDirectory()
  } catch {
    return false
  }
}

/**
 * Remove src/renderer/src/file-viewers/dirs in `dst` that no longer exist in `src` — the `--delete`
 * occasionally misses these on ExFAT, so the script sweeps the destination too.
 */
async function cleanupStale(src: string, dst: string, excludes: string[]): Promise<number> {
  let removed = 0
  const srcRoot = src.replace(/\/$/, '')
  const dstRoot = dst.replace(/\/$/, '')

  const walk = async (dir: string): Promise<void> => {
    let entries: StorageDirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    // Recurse first (bottom-up) so emptied dirs can be removed in this pass.
    for (const e of entries) {
      if (e.isDirectory() && !e.isSymbolicLink()) await walk(join(dir, e.name))
    }
    for (const e of entries) {
      const abs = join(dir, e.name)
      const rel = relative(dstRoot, abs).split(sep).join('/')
      if (isExcluded(rel, excludes)) continue
      const srcPath = join(srcRoot, rel)
      let srcExists = true
      try {
        await fs.lstat(srcPath)
      } catch {
        srcExists = false
      }
      if (srcExists) continue
      try {
        await fs.rm(abs, { recursive: true, force: true })
        removed++
      } catch {
        // leave it; surfaced indirectly by the next run
      }
    }
  }

  if (await isDir(dstRoot)) await walk(dstRoot)
  return removed
}

// ---- Runner ---------------------------------------------------------------

let running = false

/** Outcome of one: the count actually archived, plus a reason if anything failed. */
interface MappingOutcome {
  archived: number
  /** Individual entries the engine could not handle. */
  failedItems: number
  error?: string
}

interface DatasetSnapshots {
  stagingRoot: string | null
  files: Map<string, string>
  excluded?: string[]
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

async function prepareDatasetSnapshots(_vaultRoot: string): Promise<DatasetSnapshots> {
  return prepareStorageSnapshots()
}

/** Mirror one mapping. Log lines go to `onLine`; progress ticks to `onPercent`
 *  (throttled inside the engine). Resolves with the count of files moved to
 *  trash — which is real work whether or not some other entry failed, so it is
 *  reported either way — plus `error` when the engine could not handle
 *  everything. */
async function runMapping(
  mapping: MirrorMapping,
  backupDir: string,
  sourceOverrides: ReadonlyMap<string, string>,
  onLine: (line: string) => void,
  onPercent: (percent: number) => void
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
    onPercent
  )
  if (!outcome.ok) {
    return {
      archived: outcome.archived,
      failedItems: outcome.errors.length,
      error: outcome.message ?? t('backend.mirrorFailed')
    }
  }
  return { archived: outcome.archived, failedItems: 0 }
}

/**
 * Run the full mirror operation: accept a plan, mirror every mapping, sweep
 * stale destination files, and append a one-line summary to the master log.
 * Streams log output through `onLine` and per-mapping progress through `onProgress`.
 * Single-flight (see the running guard).
 */
export async function runMirror(
  vaultRoot: string,
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
  const logLines: string[] = []
  const emitLine = (line: string): void => {
    logLines.push(line)
    onLine(line)
  }
  let stagingRoot: string | null = null
  try {
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
    const snapshots = await prepareDatasetSnapshots(vaultRoot)
    stagingRoot = snapshots.stagingRoot
    const mappingCount = config.mappings.length
    let archived = 0
    let errors = 0
    // `errors` counts folders, `failedItems` counts entries — a folder can fail
    // over thousands of them, and only the second number says so.
    let failedItems = 0

    emitLine(t('backend.started', { time: ts, label: config.label }))
    for (let mi = 0; mi < config.mappings.length; mi++) {
      const mapping = withSnapshotExcludes(config.mappings[mi], snapshots.excluded)
      const folder = basename(mapping.source.replace(/\/$/, ''))
      const mappingBase = { index: mi + 1, folder, source: mapping.source, destination: mapping.destination }
      onMapping({ ...mappingBase, status: 'running' })
      try {
        await fs.access(mapping.source)
      } catch {
        emitLine(t('backend.sourceMissingLog', { path: mapping.source }))
        onMapping({ ...mappingBase, status: 'skipped', message: t('backend.sourceMissingShort') })
        errors++
        continue
      }
      try {
        await fs.mkdir(mapping.destination, { recursive: true })
      } catch {
        emitLine(t('backend.destinationMissingLog', { path: mapping.destination }))
        onMapping({ ...mappingBase, status: 'skipped', message: t('backend.destinationMissing') })
        errors++
        continue
      }

      const backupDir = config.trashPath ? join(config.trashPath, ts, folder) : join(mapping.destination, '.trash', ts)
      emitLine(t('backend.syncing', { folder }))

      const base = { folder, mappingIndex: mi + 1, mappingCount }
      // Until the engine emits its first percentage it's scanning both trees.
      onProgress({ ...base, percent: 0, etaSeconds: null, phase: 'scanning' })
      let transferStart = 0
      const outcome = await runMapping(mapping, backupDir, mappingOverrides(mapping, snapshots.files), emitLine, (percent) => {
        if (transferStart === 0) transferStart = Date.now()
        onProgress({
          ...base,
          percent,
          etaSeconds: computeEtaSeconds(Date.now() - transferStart, percent),
          phase: 'transferring'
        })
      })
      if (outcome.error) {
        // Whatever the engine did manage still counts — the run is reported as
        // failed, but the archived files it produced are not disowned.
        emitLine(t('backend.failedLog', { folder, error: outcome.error }))
        onMapping({
          ...mappingBase,
          status: 'failed',
          archived: outcome.archived,
          failedItems: outcome.failedItems,
          message: outcome.error
        })
        archived += outcome.archived
        failedItems += outcome.failedItems
        errors++
        continue
      }
      onProgress({ ...base, percent: 100, etaSeconds: 0, phase: 'transferring' })
      onMapping({ ...mappingBase, status: 'done', archived: outcome.archived })
      archived += outcome.archived
      emitLine(t('backend.archivedLog', { folder, count: outcome.archived }))

      const cleaned = await cleanupStale(mapping.source, mapping.destination, mirrorExcludes(mapping.exclude))
      if (cleaned) emitLine(t('backend.cleanup', { count: cleaned }))
    }

    // Drop an empty timestamp trash dir (nothing was archived this run).
    if (config.trashPath) {
      const tsDir = join(config.trashPath, ts)
      try {
        if ((await fs.readdir(tsDir)).length === 0) await fs.rmdir(tsDir)
      } catch {
        // dir absent or non-empty — leave it
      }
    }

    // Retention: prune old timestamped archives after a successful run.
    if (config.retention !== null && errors === 0) {
      const pruned = await pruneMirrorArchives(config)
      if (pruned.dropped.length || pruned.errors.length) {
        emitLine(
          t('backend.retention', { kept: pruned.kept, count: pruned.dropped.length }) +
            (pruned.errors.length ? t('backend.retentionFailures', { count: pruned.errors.length }) : '')
        )
      }
    }

    const durationSec = Math.round((Date.now() - started) / 1000)
    emitLine(
      t('backend.complete', { seconds: durationSec, archived, errors }) +
        (failedItems ? t('backend.failedCount', { count: failedItems }) : '')
    )
    await Promise.all([
      writeSessionLog(config.logDirectory, ts, logLines),
      appendMasterLog(config.masterLog, ts, durationSec, archived, errors)
    ])

    return {
      ok: errors === 0,
      mappings: config.mappings.length,
      archived,
      durationSec,
      errors,
      failedItems
    }
  } finally {
    if (stagingRoot) await releaseStorageSnapshot(stagingRoot).catch(() => undefined)
    running = false
  }
}

async function writeSessionLog(logDirectory: string, ts: string, lines: readonly string[]): Promise<void> {
  if (!logDirectory) return
  try {
    await fs.mkdir(logDirectory, { recursive: true })
    await fs.writeFile(join(logDirectory, `${ts}.log`), `${lines.join('\n')}\n`, 'utf-8')
  } catch {
    // Run logging is best-effort; mirror success must not depend on a log drive.
  }
}

async function appendMasterLog(
  masterLog: string,
  ts: string,
  durationSec: number,
  archived: number,
  errors: number
): Promise<void> {
  if (!masterLog) return
  try {
    await fs.mkdir(dirname(masterLog), { recursive: true })
    const line = `${ts} [INFO] duration=${durationSec}s archived=${archived} errors=${errors}\n`
    await fs.appendFile(masterLog, line)
  } catch {
    // logging is best-effort
  }
}
