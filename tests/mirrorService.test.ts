import { mirrorFixture } from './mirrorFixture'
import { vi } from 'vitest'
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, sep } from 'path'
import {
  ARCHIVE_DIR,
  createMirrorService,
  freeBytesOn,
  planMapping,
  unsafeBackupPath,
  volumeRoot,
  mirrorTimestamp,
  computeEtaSeconds,
} from '../src/backend/mirrorService'
import type { MirrorPlan } from '../src/types'

const { preflightMirror, runMirror, runRestore } = createMirrorService(mirrorFixture())

describe('runMirror', () => {
  it('mirrors, archives overwritten files, and writes both configured logs', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-run-'))
    const realm = join(root, 'realm')
    const source = join(root, 'source')
    const destination = join(root, 'destination')
    const trash = join(root, 'trash')
    const logs = join(root, 'logs')
    const masterLog = join(root, 'master.log')
    try {
      await fs.mkdir(source, { recursive: true })
      await fs.mkdir(destination, { recursive: true })
      await fs.writeFile(join(source, 'new.md'), 'new file', 'utf-8')
      await fs.writeFile(join(source, 'changed.md'), 'new and longer contents', 'utf-8')
      await fs.writeFile(join(destination, 'changed.md'), 'old contents', 'utf-8')
      await fs.writeFile(join(destination, 'gone.md'), 'deleted contents', 'utf-8')
      await fs.mkdir(realm, { recursive: true })
      const plan: MirrorPlan = {
        label: 'Local test',
        retention: null,
        ...{ trashPath: '', logDirectory: '', masterLog: '' },
        trashPath: trash,
        logDirectory: logs,
        masterLog,
        mappings: [{ source, destination, exclude: [] }]
      }

      const streamed: string[] = []
      const result = await runMirror(plan, (line) => streamed.push(line))
      expect(result).toMatchObject({ ok: true, mappings: 1, archived: 2, errors: 0 })
      expect(await fs.readFile(join(destination, 'new.md'), 'utf-8')).toBe('new file')
      expect(await fs.readFile(join(destination, 'changed.md'), 'utf-8')).toBe('new and longer contents')
      await expect(fs.access(join(destination, 'gone.md'))).rejects.toThrow()

      const [stamp] = await fs.readdir(trash)
      expect(await fs.readFile(join(trash, stamp, 'source', 'changed.md'), 'utf-8')).toBe('old contents')
      expect(await fs.readFile(join(trash, stamp, 'source', 'gone.md'), 'utf-8')).toBe('deleted contents')
      const runLogs = await fs.readdir(logs)
      expect(runLogs).toEqual([`${stamp}.log`])
      const runLog = await fs.readFile(join(logs, runLogs[0]), 'utf-8')
      expect(runLog).toContain('Mirror started')
      expect(runLog).toContain('SESSION COMPLETE')
      expect(streamed.join('\n')).toContain('SESSION COMPLETE')
      expect(await fs.readFile(masterLog, 'utf-8')).toContain('copied=2 archived=2 errors=0')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('checks and mirrors two independent source folders in one profile', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-two-folders-'))
    const realm = join(root, 'realm')
    const ferns = join(root, 'sources', 'ferns')
    const mosses = join(root, 'sources', 'mosses')
    const fernsMirror = join(root, 'mirrored', 'ferns')
    const mossesMirror = join(root, 'mirrored', 'mosses')
    try {
      await fs.mkdir(ferns, { recursive: true })
      await fs.mkdir(mosses, { recursive: true })
      await fs.mkdir(fernsMirror, { recursive: true })
      await fs.mkdir(mossesMirror, { recursive: true })
      await fs.writeFile(join(ferns, 'bracken.md'), 'fern fixture', 'utf-8')
      await fs.writeFile(join(mosses, 'sphagnum.md'), 'moss fixture', 'utf-8')
      await fs.mkdir(realm, { recursive: true })
      const plan: MirrorPlan = {
        label: 'Two folders',
        retention: null,
        ...{ trashPath: '', logDirectory: '', masterLog: '' },
        mappings: [
          { source: ferns, destination: fernsMirror, exclude: [] },
          { source: mosses, destination: mossesMirror, exclude: [] }
        ]
      }

      const completed: string[] = []
      const result = await runMirror(
        plan,
        () => {},
        () => {},
        (mapping) => {
          if (mapping.status === 'done') completed.push(mapping.folder)
        }
      )

      expect(result).toMatchObject({ ok: true, mappings: 2, errors: 0 })
      expect(completed).toEqual(['ferns', 'mosses'])
      expect(await fs.readFile(join(fernsMirror, 'bracken.md'), 'utf-8')).toBe('fern fixture')
      expect(await fs.readFile(join(mossesMirror, 'sphagnum.md'), 'utf-8')).toBe('moss fixture')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  // `errors` counts folders. A folder that fails over thousands of entries used
  // to report "1 error(s)" in the panel, which is how a backup that could delete
  // nothing at all read as a single harmless error for a week.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'reports how many individual items failed, not just how many folders did',
    async () => {
      const root = await fs.mkdtemp(join(tmpdir(), 'mirror-items-'))
      const realm = join(root, 'realm')
      const source = join(root, 'source')
      const destination = join(root, 'destination')
      try {
        // `locked` exists on both sides, so only its contents are deletes — and
        // the escrow of each one fails against the unwritable directory.
        await fs.mkdir(join(source, 'locked'), { recursive: true })
        await fs.mkdir(join(destination, 'locked'), { recursive: true })
        await fs.writeFile(join(destination, 'locked', 'a.md'), 'a', 'utf-8')
        await fs.writeFile(join(destination, 'locked', 'b.md'), 'b', 'utf-8')
        await fs.chmod(join(destination, 'locked'), 0o500)
        await fs.mkdir(realm, { recursive: true })
        const plan: MirrorPlan = {
          label: 'Local test',
          retention: null,
          ...{ trashPath: '', logDirectory: '', masterLog: '' },
          trashPath: join(root, 'trash'),
          mappings: [{ source, destination, exclude: [] }]
        }

        const streamed: string[] = []
        const result = await runMirror(plan, (line) => streamed.push(line))

        expect(result).toMatchObject({ ok: false, errors: 1, failedItems: 2 })
        expect(streamed.join('\n')).toContain('2 item(s) failed')
      } finally {
        await fs.chmod(join(destination, 'locked'), 0o700).catch(() => undefined)
        await fs.rm(root, { recursive: true, force: true })
      }
    }
  )
})

describe('default archive folder', () => {
  const plan = (source: string, destination: string, extra: Partial<MirrorPlan> = {}): MirrorPlan => ({
    label: 'Default archive', retention: null, trashPath: '', logDirectory: '', masterLog: '',
    mappings: [{ source, destination, exclude: [] }], ...extra
  })

  // Regression: archives written to the destination's own folder used to be
  // swept away as stale content right after the run that wrote them, and the
  // next run then tried to escrow the archive folder into itself.
  it('keeps every archive across consecutive runs and never mirrors the archive folder', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-archive-'))
    const source = join(root, 'source'), destination = join(root, 'destination')
    try {
      await fs.mkdir(source, { recursive: true })
      await fs.mkdir(destination, { recursive: true })
      await fs.writeFile(join(source, 'note.md'), 'first version', 'utf-8')
      await fs.writeFile(join(destination, 'stale.md'), 'only in the backup', 'utf-8')
      const first = await runMirror(plan(source, destination), () => {})
      expect(first).toMatchObject({ ok: true, archived: 1, copied: 1, errors: 0 })

      await new Promise((resolve) => setTimeout(resolve, 1100))
      await fs.writeFile(join(source, 'note.md'), 'second, longer version', 'utf-8')
      const second = await runMirror(plan(source, destination), () => {})
      expect(second).toMatchObject({ ok: true, archived: 1, copied: 1, errors: 0, failedItems: 0 })

      const stamps = (await fs.readdir(join(destination, ARCHIVE_DIR))).sort()
      expect(stamps).toHaveLength(2)
      expect(await fs.readFile(join(destination, ARCHIVE_DIR, stamps[0], 'stale.md'), 'utf-8')).toBe('only in the backup')
      expect(await fs.readFile(join(destination, ARCHIVE_DIR, stamps[1], 'note.md'), 'utf-8')).toBe('first version')
      expect(await fs.readFile(join(destination, 'note.md'), 'utf-8')).toBe('second, longer version')

      const third = await runMirror(plan(source, destination), () => {})
      expect(third).toMatchObject({ ok: true, archived: 0, copied: 0 })
      expect((await fs.readdir(join(destination, ARCHIVE_DIR))).sort()).toEqual(stamps)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('restores without copying the archive folder into the source', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-archive-restore-'))
    const source = join(root, 'source'), destination = join(root, 'destination')
    try {
      await fs.mkdir(join(destination, ARCHIVE_DIR, '2026-01-01_00-00-00'), { recursive: true })
      await fs.writeFile(join(destination, ARCHIVE_DIR, '2026-01-01_00-00-00', 'old.md'), 'archived', 'utf-8')
      await fs.writeFile(join(destination, 'kept.md'), 'backed up', 'utf-8')
      await fs.mkdir(source, { recursive: true })
      const out = await runRestore({ source, destination, exclude: [] }, { dryRun: false })
      expect(out).toMatchObject({ ok: true, creates: ['kept.md'] })
      expect(await fs.readdir(source)).toEqual(['kept.md'])
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('never mirrors, deletes or escrows its own archive and log folders inside a mapping', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-owned-'))
    const source = join(root, 'source'), destination = join(root, 'destination')
    const extra = { trashPath: join(destination, 'archive'), logDirectory: join(source, 'logs'), masterLog: join(destination, 'master.log') }
    try {
      await fs.mkdir(join(source, 'logs'), { recursive: true })
      await fs.writeFile(join(source, 'logs', 'earlier.log'), 'earlier run', 'utf-8')
      await fs.writeFile(join(source, 'a.md'), 'A', 'utf-8')
      await fs.mkdir(destination, { recursive: true })
      await fs.writeFile(join(destination, 'gone.md'), 'gone', 'utf-8')
      expect(planMapping(plan(source, destination, extra), { source, destination, exclude: [] }).exclude).toEqual(['archive/', 'logs/', 'master.log'])

      for (let run = 0; run < 2; run++) {
        const result = await runMirror(plan(source, destination, extra), () => {})
        expect(result).toMatchObject({ ok: true, errors: 0, failedItems: 0 })
      }
      await expect(fs.access(join(destination, 'logs'))).rejects.toThrow()
      expect(await fs.readFile(join(destination, 'a.md'), 'utf-8')).toBe('A')
      const [stamp] = await fs.readdir(join(destination, 'archive'))
      expect(await fs.readFile(join(destination, 'archive', stamp, 'source', 'gone.md'), 'utf-8')).toBe('gone')
      expect((await fs.readFile(extra.masterLog, 'utf-8')).trim().split('\n')).toHaveLength(2)
      const logs = await fs.readdir(join(source, 'logs'))
      expect(logs).toContain('earlier.log')
      expect(logs.some((name) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.log$/.test(name))).toBe(true)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

describe('streamed session log', () => {
  it('appends a large run to the log in bounded chunks', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-log-'))
    const source = join(root, 'source'), destination = join(root, 'destination'), logs = join(root, 'logs')
    const appended: number[] = []
    const fixture = mirrorFixture()
    const append = fixture.fs.appendFile.bind(fixture.fs)
    const service = createMirrorService({ ...fixture, fs: new Proxy(fixture.fs, { get: (target, key) => key === 'appendFile' ? async (path: string, text: string) => { appended.push(text.split('\n').length - 1); return append(path, text) } : Reflect.get(target, key) }) })
    try {
      await fs.mkdir(source, { recursive: true })
      for (let i = 0; i < 1200; i++) await fs.writeFile(join(source, `n${i}.md`), String(i), 'utf-8')
      const result = await service.runMirror({ label: 'Many', retention: null, trashPath: '', logDirectory: logs, masterLog: '', mappings: [{ source, destination, exclude: [] }] }, () => {})
      expect(result).toMatchObject({ ok: true, copied: 1200 })
      expect(Math.max(...appended)).toBeLessThanOrEqual(500)
      const [log] = await fs.readdir(logs)
      const text = await fs.readFile(join(logs, log), 'utf-8')
      expect(text).toContain('SESSION COMPLETE')
      expect(text.split('\n').filter((line) => /^  n\d+\.md$/.test(line))).toHaveLength(1200)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})

describe('volumeRoot', () => {
  it('extracts the macOS volume mount point', () => {
    expect(volumeRoot('/Volumes/T7/Backup/2026/x')).toBe('/Volumes/T7')
    expect(volumeRoot('/Volumes/My Drive/x')).toBe('/Volumes/My Drive')
  })
  it('extracts a Linux removable mount point', () => {
    expect(volumeRoot('/media/me/T7/Backup')).toBe('/media/me/T7')
    expect(volumeRoot('/run/media/me/T7/Backup')).toBe('/run/media/me/T7')
    expect(volumeRoot('/mnt/backup/x')).toBe('/mnt/backup')
  })
  it('treats a non-system Windows drive as its own mount point', () => {
    // The drive IS the mount point on Windows, so an unplugged E: must be
    // caught here — otherwise the run mkdir -p's the destination onto C:.
    expect(volumeRoot('E:\\Backup\\Biodiversity')).toBe(`E:${sep}`)
    expect(volumeRoot('e:/Backup')).toBe(`E:${sep}`)
  })
  it('returns null for internal paths', () => {
    expect(volumeRoot('/opt/valley-fixtures/source')).toBeNull()
    expect(volumeRoot('relative/x')).toBeNull()
    // C: is the system volume — always present, never a mount to check.
    expect(volumeRoot('C:\\FixtureData')).toBeNull()
  })
})

describe('preflightMirror', () => {
  let srcDir = ''
  let dstDir = ''
  const profile = (mappings: MirrorPlan['mappings']): MirrorPlan => ({
    label: 'Test',
    retention: null,
    mappings,
    trashPath: '',
    logDirectory: '',
    masterLog: ''
  })

  beforeAll(async () => {
    srcDir = await fs.mkdtemp(join(tmpdir(), 'mirror-src-'))
    dstDir = await fs.mkdtemp(join(tmpdir(), 'mirror-dst-'))
  })
  afterAll(async () => {
    await fs.rm(srcDir, { recursive: true, force: true })
    await fs.rm(dstDir, { recursive: true, force: true })
  })

  it('flags a profile with no mappings', async () => {
    const issues = await preflightMirror(profile([]))
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('no-mappings')
  })

  it('flags a missing source folder', async () => {
    const issues = await preflightMirror(
      profile([{ source: '/no/such/source/folder', destination: dstDir, exclude: [] }])
    )
    expect(issues.some((i) => i.kind === 'source-missing')).toBe(true)
  })

  it('flags an unmounted destination drive', async () => {
    const issues = await preflightMirror(
      profile([{ source: srcDir, destination: '/Volumes/NopeDriveXYZ/Backup', exclude: [] }])
    )
    const drive = issues.find((i) => i.kind === 'drive-not-mounted')
    expect(drive).toBeTruthy()
    expect(drive?.driveRoot).toBe('/Volumes/NopeDriveXYZ')
  })

  it('blocks a destination inside its source, a source inside its destination and an archive on either', async () => {
    const inside = await preflightMirror(profile([{ source: srcDir, destination: join(srcDir, 'mirror'), exclude: [] }]))
    expect(inside.map((issue) => issue.kind)).toEqual(['overlap'])
    const around = await preflightMirror(profile([{ source: join(dstDir, 'data'), destination: dstDir, exclude: [] }]))
    expect(around.map((issue) => issue.kind)).toEqual(['overlap'])
    const same = await preflightMirror({ ...profile([{ source: srcDir, destination: dstDir, exclude: [] }]), trashPath: dstDir })
    expect(same.map((issue) => issue.kind)).toEqual(['overlap'])
  })

  it('passes when source exists and destination is reachable', async () => {
    const issues = await preflightMirror(
      profile([{ source: srcDir, destination: join(dstDir, 'sub', 'not-yet-created'), exclude: [] }])
    )
    expect(issues).toEqual([])
  })
})

describe('mirror safety', () => {
  const tree = async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-safety-'))
    const source = join(root, 'source')
    const destination = join(root, 'destination')
    await fs.mkdir(source, { recursive: true })
    await fs.mkdir(destination, { recursive: true })
    const plan = (extra: Partial<MirrorPlan> = {}): MirrorPlan => ({ label: 'Safety', retention: null, trashPath: '', logDirectory: '', masterLog: '', mappings: [{ source, destination, exclude: [] }], ...extra })
    return { root, source, destination, plan, close: () => fs.rm(root, { recursive: true, force: true }) }
  }

  it('removes replaced files outright and writes no logs when both options are off', async () => {
    const { root, source, destination, plan, close } = await tree()
    try {
      const trashPath = join(root, 'deleted-files')
      const logDirectory = join(root, 'logs')
      const masterLog = join(root, 'master.log')
      await fs.writeFile(join(source, 'changed.md'), 'new and longer contents')
      await fs.writeFile(join(destination, 'changed.md'), 'old')
      await fs.writeFile(join(destination, 'gone.md'), 'old')
      const result = await runMirror(plan({ trashPath, logDirectory, masterLog, noArchive: true, noLogs: true }), () => {})
      expect(result).toMatchObject({ ok: true, archived: 0, copied: 1 })
      expect(await fs.readFile(join(destination, 'changed.md'), 'utf-8')).toBe('new and longer contents')
      await expect(fs.access(join(destination, 'gone.md'))).rejects.toThrow()
      await expect(fs.access(join(destination, ARCHIVE_DIR))).rejects.toThrow()
      for (const path of [trashPath, logDirectory, masterLog]) await expect(fs.access(path)).rejects.toThrow()
    } finally { await close() }
  })

  it('changes nothing when a folder cannot be read', async () => {
    const { source, destination, plan, close } = await tree()
    try {
      await fs.mkdir(join(source, 'locked'))
      await fs.writeFile(join(source, 'kept.md'), 'kept')
      await fs.mkdir(join(destination, 'locked'))
      await fs.writeFile(join(destination, 'locked', 'precious.md'), 'precious')
      const fixture = mirrorFixture()
      const readdir = fixture.fs.readdir
      const service = createMirrorService({ ...fixture, fs: new Proxy(fixture.fs, { get: (target, key) => key === 'readdir' ? (path: string, options: never) => path === join(source, 'locked') ? Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) : readdir(path, options) : Reflect.get(target, key) }) })
      const result = await service.runMirror(plan(), () => {})
      expect(result.ok).toBe(false)
      expect(await fs.readFile(join(destination, 'locked', 'precious.md'), 'utf-8')).toBe('precious')
      await expect(fs.access(join(destination, 'kept.md'))).rejects.toThrow()
    } finally { await close() }
  })

  it('refuses an emptied source instead of wiping its backup', async () => {
    const { destination, plan, close } = await tree()
    try {
      await fs.writeFile(join(destination, 'precious.md'), 'precious')
      const result = await runMirror(plan(), () => {})
      expect(result.ok).toBe(false)
      expect(await fs.readFile(join(destination, 'precious.md'), 'utf-8')).toBe('precious')
    } finally { await close() }
  })

  it('treats one name in two Unicode spellings as the same file', async () => {
    const { source, destination, plan, close } = await tree()
    try {
      const stamp = new Date('2026-01-01T00:00:00Z')
      await fs.writeFile(join(source, 'Zu\u0308rich.md'), 'same')
      await fs.writeFile(join(destination, 'Z\u00fcrich.md'), 'same')
      await fs.utimes(join(source, 'Zu\u0308rich.md'), stamp, stamp)
      await fs.utimes(join(destination, 'Z\u00fcrich.md'), stamp, stamp)
      expect(await runMirror(plan(), () => {})).toMatchObject({ ok: true, copied: 0, archived: 0 })
    } finally { await close() }
  })

  it('skips AppleDouble, unfinished and nested-realm cache files and leaves no staged file', async () => {
    const { source, destination, plan, close } = await tree()
    try {
      await fs.writeFile(join(source, 'kept.md'), 'kept')
      await fs.writeFile(join(source, '._kept.md'), 'resource fork')
      await fs.writeFile(join(source, 'half.md.tmp.backup'), 'unfinished')
      await fs.mkdir(join(source, 'other', '.valley', 'cache'), { recursive: true })
      await fs.writeFile(join(source, 'other', '.valley', 'cache', 'index.bin'), 'cache')
      await fs.writeFile(join(destination, '._stale'), 'stays')
      expect(await runMirror(plan(), () => {})).toMatchObject({ ok: true, copied: 1, archived: 0 })
      expect((await fs.readdir(destination)).sort()).toEqual(['._stale', 'kept.md', 'other'].sort())
      await expect(fs.access(join(destination, 'other', '.valley', 'cache'))).rejects.toThrow()
    } finally { await close() }
  })

  it('refuses a copy that would not leave the reserve free, and only then', async () => {
    const { source, destination, plan, close } = await tree()
    try {
      await fs.writeFile(join(source, 'new.md'), 'new')
      const reserve = 256 * 1024 * 1024
      const full = await createMirrorService(mirrorFixture(), async () => [{ id: '/', availableBytes: reserve }]).runMirror(plan(), () => {})
      expect(full.ok).toBe(false)
      await expect(fs.access(join(destination, 'new.md'))).rejects.toThrow()
      expect(await createMirrorService(mirrorFixture(), async () => [{ id: '/', availableBytes: reserve + 3 }]).runMirror(plan(), () => {})).toMatchObject({ ok: true, copied: 1 })
      await fs.rm(join(source, 'new.md'))
      await fs.writeFile(join(source, 'kept.md'), 'new')
      await fs.utimes(join(source, 'kept.md'), new Date(0), new Date(0))
      await fs.writeFile(join(destination, 'kept.md'), 'new')
      await fs.utimes(join(destination, 'kept.md'), new Date(0), new Date(0))
      expect(await createMirrorService(mirrorFixture(), async () => [{ id: '/', availableBytes: 0 }]).runMirror(plan(), () => {})).toMatchObject({ ok: true, copied: 0 })
      await fs.writeFile(join(source, 'unchecked.md'), 'new')
      expect(await createMirrorService(mirrorFixture(), async () => { throw new Error('unavailable') }).runMirror(plan(), () => {})).toMatchObject({ ok: true, copied: 1 })
    } finally { await close() }
  })

  it('reads free space only from the volume that holds the destination', () => {
    const volumes = [{ id: '/', availableBytes: 10 }, { id: '/Volumes/T7', availableBytes: 20 }]
    expect(freeBytesOn('/Users/someone/backup', volumes)).toBe(10)
    expect(freeBytesOn('/Volumes/T7/backup', volumes)).toBe(20)
    expect(freeBytesOn('/Volumes/Share/backup', volumes)).toBeNull()
  })

  it('refuses system folders, home folders, whole drives and colliding destinations', async () => {
    const { source, destination, plan, close } = await tree()
    try {
      for (const path of ['/', '/Users', '/Users/someone', '/home/someone', '/Volumes/T7', '/mnt/usb', 'E:\\', 'C:\\Users\\someone']) expect(unsafeBackupPath(path), path).toBe(true)
      for (const path of ['/Volumes/T7/backup', '/Users/someone/Documents', 'E:\\backup']) expect(unsafeBackupPath(path), path).toBe(false)
      expect((await preflightMirror(plan({ mappings: [{ source, destination: '/Volumes/T7', exclude: [] }] }))).map((issue) => issue.kind)).toEqual(['unsafe-path'])
      expect((await preflightMirror(plan({ mappings: [{ source, destination: join(destination, 'a'), exclude: [] }, { source, destination: join(destination, 'a', 'b'), exclude: [] }] }))).map((issue) => issue.kind)).toEqual(['overlap'])
    } finally { await close() }
  })
})

describe('mirrorTimestamp', () => {
  it('formats as YYYY-MM-DD_HH-MM-SS', () => {
    const ts = mirrorTimestamp(new Date(2026, 5, 8, 9, 4, 5))
    expect(ts).toBe('2026-06-08_09-04-05')
  })
})

describe('computeEtaSeconds', () => {
  it('estimates remaining seconds from elapsed and percent', () => {
    // 10s got us to 50% → ~10s left.
    expect(computeEtaSeconds(10_000, 50)).toBe(10)
    // 30s to 75% → ~10s left.
    expect(computeEtaSeconds(30_000, 75)).toBe(10)
  })

  it('returns null at the boundaries', () => {
    expect(computeEtaSeconds(5000, 0)).toBeNull()
    expect(computeEtaSeconds(5000, 100)).toBeNull()
    expect(computeEtaSeconds(0, 50)).toBeNull()
  })
})
