import type { MirrorPlan, MirrorRetentionPolicy } from '../types'
import { MirrorCancelled } from './jobLifetime'
import { join } from './path'
import type { StorageSession } from './storageFs'

/** Default archive folder inside each destination, used when a profile names
 *  no separate archive folder. Mirror runs and restores never touch it. */
export const ARCHIVE_DIR = '.backup-archive'

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

/**
 * Apply {@link planMirrorRetention} to every archive location of a config:
 * the shared `trashPath` plus each destination's {@link ARCHIVE_DIR}. One failing dir is
 * recorded and the sweep continues — never a partial-delete inside one archive
 * (each timestamped dir is removed atomically-per-dir via `rm -r`).
 */
export interface PruneResult {
  cancelled?: boolean
  scanned: number
  kept: number
  dropped: string[]
  errors: { dir: string; message: string }[]
}

export function createArchiveRetention(storage: Pick<StorageSession, 'fs' | 'assertActive'>) {
  const { fs } = storage
  async function pruneMirrorArchives(
    config: MirrorPlan,
    opts: { dryRun?: boolean; now?: Date } = {}
  ): Promise<PruneResult> {
    if (!config.retention) return { scanned: 0, kept: 0, dropped: [], errors: [] }
    const now = opts.now ?? new Date()
    const roots = new Set<string>()
    if (config.trashPath) roots.add(config.trashPath)
    for (const m of config.mappings) roots.add(join(m.destination, ARCHIVE_DIR))

    const result: PruneResult = { scanned: 0, kept: 0, dropped: [], errors: [] }
    try {
    for (const root of roots) {
      storage.assertActive()
      let names: string[]
      try {
        names = (await fs.readdir(root, { withFileTypes: true }))
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      } catch {
        storage.assertActive()
        continue // location absent (drive unplugged) — nothing to prune
      }
      const plan = planMirrorRetention(names, now, config.retention)
      result.scanned += plan.keep.length + plan.drop.length
      result.kept += plan.keep.length
      for (const name of plan.drop) {
        storage.assertActive()
        if (opts.dryRun) {
          result.dropped.push(join(root, name))
          continue
        }
        try {
          await fs.rm(join(root, name), { recursive: true })
          result.dropped.push(join(root, name))
        } catch (err) {
          if (err instanceof MirrorCancelled) throw err
          result.errors.push({ dir: join(root, name), message: err instanceof Error ? err.message : String(err) })
        }
      }
    }
    return result
    } catch (error) {
      if (!(error instanceof MirrorCancelled)) throw error
      return { ...result, cancelled: true, errors: [...result.errors, { dir: '', message: error.message }] }
    }
  }

  return pruneMirrorArchives
}
