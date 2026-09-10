vi.mock('../src/backend/storageFs', async () => ({ storageFs: (await import('node:fs')).promises, prepareStorageSnapshots: async () => ({ stagingRoot: null, files: new Map() }), releaseStorageSnapshot: async () => {} }))
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { planMirrorRetention, pruneMirrorArchives, mirrorTimestamp } from '../src/backend/mirrorService'

const RETENTION = { keepDays: 7, dailies: 30, weeklies: 8 }
const NOW = new Date(2026, 6, 18, 12, 0, 0) // 2026-07-18 local

const stamp = (daysAgo: number, hour = 12): string =>
  mirrorTimestamp(new Date(NOW.getTime() - daysAgo * 24 * 3600 * 1000 + (hour - 12) * 3600 * 1000))

describe('planMirrorRetention', () => {
  it('keeps everything under a week, newest per day for 30 days, newest per ISO week for 8 weeks', () => {
    const names = [
      stamp(0),
      stamp(3),
      stamp(6),
      // day 10: two runs — only the newest survives the daily tier
      stamp(10, 18),
      stamp(10, 9),
      stamp(20),
      // ~5 weeks out: two runs in the same ISO week — newest survives weekly tier
      stamp(35),
      stamp(36),
      // ~10 weeks: beyond weeklies → dropped
      stamp(70),
      stamp(71)
    ]
    const plan = planMirrorRetention(names, NOW, RETENTION)
    expect(plan.keep).toContain(stamp(0))
    expect(plan.keep).toContain(stamp(3))
    expect(plan.keep).toContain(stamp(6))
    expect(plan.keep).toContain(stamp(10, 18))
    expect(plan.drop).toContain(stamp(10, 9))
    expect(plan.keep).toContain(stamp(20))
    expect(plan.keep).toContain(stamp(35))
    expect(plan.drop).toContain(stamp(36))
    expect(plan.drop).toContain(stamp(70))
    expect(plan.drop).toContain(stamp(71))
  })

  it('never touches names that are not timestamp-shaped', () => {
    const plan = planMirrorRetention(['wichtig', 'Fotos-Archiv', '2026-13-99_99-99-99x'], NOW, RETENTION)
    expect(plan.keep).toEqual([])
    expect(plan.drop).toEqual([])
  })
})

describe('pruneMirrorArchives', () => {
  let root: string
  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'mirror-prune-'))
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(root, { recursive: true, force: true })
  })

  const config = (trashPath: string) => ({
    trashPath,
    logDirectory: '',
    masterLog: '',
    mappings: [],
    label: 'Archives',
    retention: RETENTION
  })

  it('drops only old timestamped dirs and reports the sweep', async () => {
    const trash = join(root, 'trash')
    const oldDir = stamp(80)
    const freshDir = stamp(1)
    for (const name of [oldDir, freshDir, 'behalte-mich']) {
      await fs.mkdir(join(trash, name), { recursive: true })
      await fs.writeFile(join(trash, name, 'f.txt'), 'x', 'utf-8')
    }
    const res = await pruneMirrorArchives(config(trash), { now: NOW })
    expect(res.dropped).toEqual([join(trash, oldDir)])
    expect(res.errors).toEqual([])
    expect(await fs.readdir(trash).then((n) => n.sort())).toEqual([freshDir, 'behalte-mich'].sort())
  })

  it('dry run deletes nothing', async () => {
    const trash = join(root, 'trash')
    await fs.mkdir(join(trash, stamp(80)), { recursive: true })
    const res = await pruneMirrorArchives(config(trash), { now: NOW, dryRun: true })
    expect(res.dropped).toHaveLength(1)
    expect(await fs.readdir(trash)).toHaveLength(1)
  })

  it('one failing dir is recorded and the rest still prunes', async () => {
    const trash = join(root, 'trash')
    const bad = stamp(80)
    const alsoOld = stamp(90)
    await fs.mkdir(join(trash, bad), { recursive: true })
    await fs.mkdir(join(trash, alsoOld), { recursive: true })
    // Wrap the original so only the sabotaged dir fails.
    const original = fs.rm.bind(fs)
    vi.spyOn(fs, 'rm').mockImplementation(async (p, opts) => {
      if (String(p).includes(bad)) throw Object.assign(new Error('EACCES'), { code: 'EACCES' })
      return original(p, opts)
    })
    const res = await pruneMirrorArchives(config(trash), { now: NOW })
    expect(res.errors).toHaveLength(1)
    expect(res.errors[0].dir).toContain(bad)
    expect(res.dropped).toEqual([join(trash, alsoOld)])
  })
})
