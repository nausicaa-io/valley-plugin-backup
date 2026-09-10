import { vi } from 'vitest'
vi.mock('../src/backend/storageFs', async () => ({ storageFs: (await import('node:fs')).promises, prepareStorageSnapshots: async () => ({ stagingRoot: null, files: new Map() }), releaseStorageSnapshot: async () => {} }))
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join, sep } from 'path'
import {
  preflightMirror,
  volumeRoot,
  mirrorTimestamp,
  computeEtaSeconds,
  runMirror
} from '../src/backend/mirrorService'
import type { MirrorPlan } from '../src/types'

describe('runMirror', () => {
  it('mirrors, archives overwritten files, and writes both configured logs', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-run-'))
    const vault = join(root, 'vault')
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
      await fs.mkdir(vault, { recursive: true })
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
      const result = await runMirror(vault, plan, (line) => streamed.push(line))
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
      expect(await fs.readFile(masterLog, 'utf-8')).toContain('archived=2 errors=0')
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })

  it('checks and mirrors two independent source folders in one profile', async () => {
    const root = await fs.mkdtemp(join(tmpdir(), 'mirror-two-folders-'))
    const vault = join(root, 'vault')
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
      await fs.mkdir(vault, { recursive: true })
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
        vault,
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
      const vault = join(root, 'vault')
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
        await fs.mkdir(vault, { recursive: true })
        const plan: MirrorPlan = {
          label: 'Local test',
          retention: null,
          ...{ trashPath: '', logDirectory: '', masterLog: '' },
          trashPath: join(root, 'trash'),
          mappings: [{ source, destination, exclude: [] }]
        }

        const streamed: string[] = []
        const result = await runMirror(vault, plan, (line) => streamed.push(line))

        expect(result).toMatchObject({ ok: false, errors: 1, failedItems: 2 })
        expect(streamed.join('\n')).toContain('2 item(s) failed')
      } finally {
        await fs.chmod(join(destination, 'locked'), 0o700).catch(() => undefined)
        await fs.rm(root, { recursive: true, force: true })
      }
    }
  )
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

  it('passes when source exists and destination is reachable', async () => {
    const issues = await preflightMirror(
      profile([{ source: srcDir, destination: join(dstDir, 'sub', 'not-yet-created'), exclude: [] }])
    )
    expect(issues).toEqual([])
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
