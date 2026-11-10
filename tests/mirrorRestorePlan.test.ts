import { mirrorFixture } from './mirrorFixture'
import { vi } from 'vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createMirrorEngine } from '../src/backend/mirror'
import { MirrorCancelled } from '../src/backend/jobLifetime'
import { createMirrorService } from '../src/backend/mirrorService'
const fixture = mirrorFixture()
const mirrorTree = createMirrorEngine(fixture.fs)
const { runRestore } = createMirrorService(fixture)

/**
 * These used to assert the shape of an rsync argv and parse `-i` itemized text
 * back into change buckets — which meant they passed on a machine with no rsync
 * at all, green-lighting a backup layer that could not actually run there. They
 * now drive the real mirror engine against a temp tree, so a break is a break
 * on every platform.
 */

let root = ''
const src = (): string => join(root, 'src')
const dst = (): string => join(root, 'dst')

async function write(abs: string, content: string): Promise<void> {
  await fs.mkdir(join(abs, '..'), { recursive: true })
  await fs.writeFile(abs, content, 'utf-8')
}

/** Sorted listing of a tree, dirs marked with a trailing slash. */
async function tree(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(cur: string, prefix: string): Promise<void> {
    for (const e of await fs.readdir(cur, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      if (e.isDirectory()) {
        out.push(`${rel}/`)
        await walk(join(cur, e.name), rel)
      } else out.push(rel)
    }
  }
  await walk(dir, '')
  return out.sort()
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'valley-mirror-'))
  await fs.mkdir(src(), { recursive: true })
  await fs.mkdir(dst(), { recursive: true })
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('mirrorTree', () => {
  it('copies a fresh tree and reports every path as a create (umlauts intact)', async () => {
    await write(join(src(), 'Blüten äöü.md'), 'A')
    await write(join(src(), 'Habitate/b.md'), 'B')

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [] })

    expect(out.ok).toBe(true)
    expect(out.creates.sort()).toEqual(['Blüten äöü.md', 'Habitate', 'Habitate/b.md'])
    expect(out.updates).toEqual([])
    expect(out.deletes).toEqual([])
    expect(await tree(dst())).toEqual(['Blüten äöü.md', 'Habitate/', 'Habitate/b.md'])
    expect(await fs.readFile(join(dst(), 'Habitate/b.md'), 'utf-8')).toBe('B')
  })

  it('is a no-op on an unchanged tree (mtime is preserved on copy)', async () => {
    await write(join(src(), 'a.md'), 'A')
    await mirrorTree({ source: src(), destination: dst(), exclude: [] })

    const second = await mirrorTree({ source: src(), destination: dst(), exclude: [] })

    // The whole point of preserving mtime: an incremental backup must not
    // re-copy an untouched tree on every run.
    expect(second.creates).toEqual([])
    expect(second.updates).toEqual([])
    expect(second.deletes).toEqual([])
  })

  it('detects a changed file by size', async () => {
    await write(join(src(), 'a.md'), 'A')
    await mirrorTree({ source: src(), destination: dst(), exclude: [] })
    await write(join(src(), 'a.md'), 'A much longer body')

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [] })

    expect(out.updates).toEqual(['a.md'])
    expect(await fs.readFile(join(dst(), 'a.md'), 'utf-8')).toBe('A much longer body')
  })

  it('escrows an overwritten file into the backup dir instead of destroying it', async () => {
    await write(join(src(), 'a.md'), 'original')
    await mirrorTree({ source: src(), destination: dst(), exclude: [] })
    await write(join(src(), 'a.md'), 'replacement text')

    const backupDir = join(root, 'trash/2026-06-08_10-00-00')
    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], backupDir })

    expect(out.archived).toBe(1)
    expect(await fs.readFile(join(dst(), 'a.md'), 'utf-8')).toBe('replacement text')
    expect(await fs.readFile(join(backupDir, 'a.md'), 'utf-8')).toBe('original')
  })

  it('deletes what the source no longer has, escrowing it first', async () => {
    await write(join(src(), 'keep.md'), 'keep')
    await write(join(src(), 'gone.md'), 'gone')
    await mirrorTree({ source: src(), destination: dst(), exclude: [] })
    await fs.rm(join(src(), 'gone.md'))

    const backupDir = join(root, 'trash/2026-06-08_11-00-00')
    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], backupDir })

    expect(out.deletes).toEqual(['gone.md'])
    expect(await tree(dst())).toEqual(['keep.md'])
    expect(await fs.readFile(join(backupDir, 'gone.md'), 'utf-8')).toBe('gone')
  })

  // chmod is advisory-at-best on Windows and ignored outright for root, so the
  // two failure-path cases below only mean something as an ordinary POSIX user.
  const canDenyWrite = process.platform !== 'win32' && process.getuid?.() !== 0

  it.skipIf(!canDenyWrite)('records a failed entry and keeps going', async () => {
    await write(join(src(), 'locked/b.md'), 'B')
    await write(join(src(), 'zzz/c.md'), 'C')
    await write(join(src(), 'a.md'), 'A')
    // Present but unwritable, so only the copy *into* it fails.
    await fs.mkdir(join(dst(), 'locked'), { recursive: true })
    await fs.chmod(join(dst(), 'locked'), 0o500)

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [] })
    await fs.chmod(join(dst(), 'locked'), 0o700)

    expect(out.ok).toBe(false)
    expect(out.errors).toHaveLength(1)
    expect(out.errors[0]).toContain('locked/b.md')
    // The entry after the failure — and the one before it — still transferred.
    expect(await fs.readFile(join(dst(), 'zzz/c.md'), 'utf-8')).toBe('C')
    expect(await fs.readFile(join(dst(), 'a.md'), 'utf-8')).toBe('A')
  })

  it.skipIf(!canDenyWrite)('never deletes a destination file whose escrow failed', async () => {
    // `locked` exists on both sides, so only the file inside it is a delete.
    await fs.mkdir(join(src(), 'locked'), { recursive: true })
    await write(join(dst(), 'locked/stale.md'), 'stale')
    await fs.chmod(join(dst(), 'locked'), 0o500)

    const backupDir = join(root, 'trash/2026-06-08_11-00-00')
    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], backupDir })
    await fs.chmod(join(dst(), 'locked'), 0o700)

    expect(out.ok).toBe(false)
    expect(out.errors).toHaveLength(1)
    expect(out.archived).toBe(0)
    // The rename failed with EACCES, not EXDEV, so the copy-then-remove fallback
    // must not have run: the file is still where it was, and nothing was left
    // half-copied in the escrow to be mistaken for an archived version of it.
    expect(await fs.readFile(join(dst(), 'locked/stale.md'), 'utf-8')).toBe('stale')
    await expect(fs.access(join(backupDir, 'locked/stale.md'))).rejects.toThrow()
  })

  it('never copies or deletes an excluded path', async () => {
    await write(join(src(), 'a.md'), 'A')
    await write(join(src(), 'cache/junk.tmp'), 'junk')
    // A destination-only file the excludes cover must survive --delete.
    await write(join(dst(), 'cache/previous.tmp'), 'previous')

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: ['cache/', '*.tmp'] })

    expect(out.creates).toEqual(['a.md'])
    expect(out.deletes).toEqual([])
    expect(await tree(dst())).toEqual(['a.md', 'cache/', 'cache/previous.tmp'])
  })

  it('dry run reports the plan and touches nothing', async () => {
    await write(join(src(), 'a.md'), 'A')
    await write(join(dst(), 'stale.md'), 'stale')

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], dryRun: true })

    expect(out.ok).toBe(true)
    expect(out.creates).toEqual(['a.md'])
    expect(out.deletes).toEqual(['stale.md'])
    expect(await tree(dst())).toEqual(['stale.md'])
  })

  it('fails cleanly when the source is unavailable', async () => {
    const out = await mirrorTree({ source: join(root, 'nope'), destination: dst(), exclude: [] })

    expect(out.ok).toBe(false)
    expect(out.message).toContain('unavailable')
  })

  it('emits progress that ends at 100', async () => {
    await write(join(src(), 'a.md'), 'A')
    await write(join(src(), 'b.md'), 'B')
    const percents: number[] = []

    await mirrorTree({ source: src(), destination: dst(), exclude: [] }, () => {}, (p) =>
      percents.push(p.percent)
    )

    expect(percents.at(-1)).toBe(100)
    expect(percents.every((p) => p >= 0 && p <= 100)).toBe(true)
  })

  it('replaces a file that became a folder in one run, escrowing the file first', async () => {
    await write(join(dst(), 'notes'), 'a single file')
    await write(join(src(), 'notes/today.md'), 'today')
    await write(join(src(), 'notes/deep/more.md'), 'more')
    const backupDir = join(root, 'trash/2026-06-08_13-00-00')

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], backupDir })

    expect(out.errors).toEqual([])
    expect(out.ok).toBe(true)
    expect(await tree(dst())).toEqual(['notes/', 'notes/deep/', 'notes/deep/more.md', 'notes/today.md'])
    expect(await fs.readFile(join(backupDir, 'notes'), 'utf-8')).toBe('a single file')
    const second = await mirrorTree({ source: src(), destination: dst(), exclude: [] })
    expect(second).toMatchObject({ ok: true, creates: [], updates: [], deletes: [] })
  })

  it('replaces a folder that became a file in one run', async () => {
    await write(join(dst(), 'report/draft.md'), 'draft')
    await write(join(src(), 'report'), 'final report')
    const backupDir = join(root, 'trash/2026-06-08_14-00-00')

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], backupDir })

    expect(out).toMatchObject({ ok: true, errors: [] })
    expect(await fs.readFile(join(dst(), 'report'), 'utf-8')).toBe('final report')
    expect(await fs.readFile(join(backupDir, 'report/draft.md'), 'utf-8')).toBe('draft')
  })

  it('weights progress by bytes and reports entry and byte counters', async () => {
    await write(join(src(), 'big.bin'), 'x'.repeat(400_000))
    await write(join(src(), 'small.md'), 's')
    const ticks: Array<{ percent: number; files: { done: number; total: number }; bytes: { done: number; total: number } }> = []

    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [] }, () => {}, (tick) => ticks.push(tick))

    expect(out).toMatchObject({ ok: true, copied: 2, bytes: 400_001 })
    const last = ticks.at(-1)!
    expect(last).toMatchObject({ percent: 100, files: { done: 2, total: 2 }, bytes: { done: 400_001, total: 400_001 } })
    expect(ticks.every((tick, index) => index === 0 || tick.bytes.done >= ticks[index - 1].bytes.done)).toBe(true)
  })

  it('escrows a removed subtree in one move, and converges on the next run', async () => {
    // The shape that broke: deletes ran deepest-first, so the children were
    // escrowed into `backupDir/gone/...` first and the rename of `gone` itself
    // then hit a non-empty directory (ENOTEMPTY). Every file moved, every parent
    // directory failed, and the next run planned the identical deletions.
    await write(join(src(), 'keep.md'), 'keep')
    await write(join(dst(), 'gone/a/b/deep.md'), 'deep')
    await write(join(dst(), 'gone/a/sibling.md'), 'sibling')
    await write(join(dst(), 'gone/top.md'), 'top')

    const backupDir = join(root, 'trash/2026-06-08_11-00-00')
    const out = await mirrorTree({ source: src(), destination: dst(), exclude: [], backupDir })

    expect(out.errors).toEqual([])
    expect(out.ok).toBe(true)
    // The plan still reports every entry — the restore preview counts it.
    expect(out.deletes).toContain('gone')
    expect(out.deletes).toContain('gone/a/b/deep.md')
    // …but the whole subtree left in one piece, and every entry is accounted for.
    expect(out.archived).toBe(out.deletes.length)
    expect(await tree(dst())).toEqual(['keep.md'])
    expect(await tree(backupDir)).toEqual([
      'gone/',
      'gone/a/',
      'gone/a/b/',
      'gone/a/b/deep.md',
      'gone/a/sibling.md',
      'gone/top.md'
    ])

    // Convergence — the property that was actually broken. A second run has
    // nothing left to do, instead of failing the same deletions all over again.
    const second = await mirrorTree({
      source: src(),
      destination: dst(),
      exclude: [],
      backupDir: join(root, 'trash/2026-06-08_12-00-00')
    })
    expect(second.ok).toBe(true)
    expect(second.deletes).toEqual([])
    expect(second.archived).toBe(0)
  })

  it('keeps a destination directory that still holds an excluded file', async () => {
    // `stale` is not excluded and the source has none of it, so it is a delete —
    // but moving it would take the excluded file inside it along, which is the
    // one thing the excludes exist to prevent.
    await write(join(src(), 'a.md'), 'A')
    await write(join(dst(), 'stale/junk.md'), 'junk')
    await write(join(dst(), 'stale/notes.keep'), 'keep me')

    const backupDir = join(root, 'trash/2026-06-08_11-00-00')
    const out = await mirrorTree({
      source: src(),
      destination: dst(),
      exclude: ['*.keep'],
      backupDir
    })

    expect(out.errors).toEqual([])
    expect(await tree(dst())).toEqual(['a.md', 'stale/', 'stale/notes.keep'])
    expect(await tree(backupDir)).toEqual(['stale/', 'stale/junk.md'])
  })
})

describe('large trees', () => {
  type Node = { kind: 'file'; size: number; mtimeMs: number } | { kind: 'dir'; children: Map<string, Node> }
  const dir = (): Extract<Node, { kind: 'dir' }> => ({ kind: 'dir', children: new Map() })
  const file = (mtimeMs = 1000): Node => ({ kind: 'file', size: 1, mtimeMs })
  function memoryFs(roots: Record<string, Extract<Node, { kind: 'dir' }>>, refuse?: (path: string, call: number) => boolean) {
    const lists = new Map<string, number>()
    const copies: string[] = []
    const removed: string[] = []
    const find = (path: string): Node | undefined => {
      for (const [root, node] of Object.entries(roots)) {
        if (path !== root && !path.startsWith(`${root}/`)) continue
        return path.slice(root.length + 1).split('/').filter(Boolean).reduce<Node | undefined>((at, name) => (at?.kind === 'dir' ? at.children.get(name) : undefined), node)
      }
      return undefined
    }
    const stat = (entry: Node, name: string) => ({ name, kind: entry.kind, size: entry.kind === 'file' ? entry.size : 0, mtimeMs: entry.kind === 'file' ? entry.mtimeMs : 0, isDirectory: () => entry.kind === 'dir', isFile: () => entry.kind === 'file', isSymbolicLink: () => false })
    const fs = {
      assertActive: () => {},
      stat: async (path: string) => stat(find(path)!, ''),
      lstat: async (path: string) => stat(find(path)!, ''),
      mkdir: async () => {},
      utimes: async () => {},
      copyFile: async (_from: string, to: string) => { copies.push(to) },
      commit: async () => {},
      rm: async (path: string) => { removed.push(path) },
      rename: async (from: string) => { removed.push(from) },
      readdir: async (path: string) => {
        const call = (lists.get(path) ?? 0) + 1
        lists.set(path, call)
        if (refuse?.(path, call)) throw new Error('unreadable')
        const node = find(path)
        if (node?.kind !== 'dir') throw Object.assign(new Error('missing'), { code: 'ENOENT' })
        return [...node.children].map(([name, entry]) => stat(entry, name))
      }
    }
    return { fs: fs as unknown as Parameters<typeof createMirrorEngine>[0], lists, copies, removed }
  }
  function tree(folders: number, perFolder: number) {
    const root = dir()
    for (let f = 0; f < folders; f++) {
      const folder = dir()
      for (let n = 0; n < perFolder; n++) folder.children.set(`file${n}`, file())
      root.children.set(`folder${f}`, folder)
    }
    return root
  }
  const paths = { source: '/src', destination: '/dst', exclude: [] as string[] }

  it('lists each folder once on both sides when nothing changed', async () => {
    const m = memoryFs({ '/src': tree(40, 100), '/dst': tree(40, 100) })
    expect(await createMirrorEngine(m.fs)(paths)).toMatchObject({ ok: true, copied: 0 })
    expect([...m.lists.values()].every((count) => count === 1)).toBe(true)
    expect(m.lists.size).toBe(82)
  })

  it('lists only the changed folder again before copying', async () => {
    const src = tree(40, 100)
    ;(src.children.get('folder7') as Extract<Node, { kind: 'dir' }>).children.set('file3', file(900_000))
    const m = memoryFs({ '/src': src, '/dst': tree(40, 100) })
    expect(await createMirrorEngine(m.fs)(paths)).toMatchObject({ ok: true, copied: 1, updates: ['folder7/file3'] })
    expect([...m.lists].filter(([, count]) => count > 1).map(([path]) => path).sort()).toEqual(['/dst/folder7', '/src/folder7'])
  })

  it('copies a whole new tree while keeping only a bounded list of its paths', async () => {
    const m = memoryFs({ '/src': tree(60, 100), '/dst': dir() })
    const out = await createMirrorEngine(m.fs)(paths)
    expect(out).toMatchObject({ ok: true, copied: 6000 })
    expect(m.copies).toHaveLength(6000)
    expect(out.creates).toHaveLength(5000)
  })

  it('leaves a destination folder alone when its source cannot be read again before the copy', async () => {
    const src = dir(), dest = dir()
    const inner = dir(); inner.children.set('kept', file())
    const innerDest = dir(); innerDest.children.set('kept', file()); innerDest.children.set('stale', file())
    src.children.set('inner', inner); dest.children.set('inner', innerDest)
    const m = memoryFs({ '/src': src, '/dst': dest }, (path, call) => path === '/src/inner' && call === 2)
    const out = await createMirrorEngine(m.fs)(paths)
    expect(out.ok).toBe(false)
    expect(m.removed).toEqual([])
  })

  it('removes a doomed folder as one unit and counts everything under it', async () => {
    const dest = dir(), gone = dir(), nested = dir()
    nested.children.set('deep', file()); gone.children.set('a', nested); gone.children.set('top', file()); dest.children.set('gone', gone); dest.children.set('other', file())
    const src = dir(); src.children.set('other', file())
    const m = memoryFs({ '/src': src, '/dst': dest, '/archive': dir() })
    expect(await createMirrorEngine(m.fs)({ ...paths, backupDir: '/archive' })).toMatchObject({ ok: true, archived: 4 })
    expect(m.removed).toEqual(['/dst/gone'])
  })

  it('keeps a folder holding an excluded file and removes its other children one by one', async () => {
    const dest = dir(), stale = dir(), sub = dir()
    sub.children.set('x', file()); stale.children.set('junk', file()); stale.children.set('notes.keep', file()); stale.children.set('sub', sub); dest.children.set('stale', stale)
    const m = memoryFs({ '/src': (() => { const s = dir(); s.children.set('other', file()); return s })(), '/dst': dest })
    expect(await createMirrorEngine(m.fs)({ ...paths, exclude: ['*.keep'] })).toMatchObject({ ok: true })
    expect(m.removed.sort()).toEqual(['/dst/stale/junk', '/dst/stale/sub'])
  })
})

describe('native mirror', () => {
  const paths = { source: '/src', destination: '/dst', exclude: [] as string[], native: true }
  const result = { ok: true, cancelled: false, archived: 1, copied: 2, bytes: 3, failed: 0, errors: [] as string[] }
  const idle = { scanning: false, percent: 100, filesDone: 2, filesTotal: 2, bytesDone: 3, bytesTotal: 3, lines: [] as string[] }
  const engine = (polls: unknown[], extra: Record<string, unknown> = {}) => {
    const cancel = vi.fn(async () => {})
    const start = vi.fn(async () => ({ poll: async () => polls.shift(), cancel }))
    const fs = { assertActive: () => {}, startNativeMirror: start, ...extra }
    return { run: createMirrorEngine(fs as unknown as Parameters<typeof createMirrorEngine>[0]), start, cancel }
  }

  it('reports the native counts and log lines', async () => {
    const lines: string[] = []
    const { run, start } = engine([{ ...idle, lines: ['copy\ta.md', 'dir\tb/', 'failed\tc: no'] }, { ...idle, outcome: result }])
    expect(await run({ ...paths, backupDir: '/arch', freeBytes: async () => 9 }, (line) => lines.push(line))).toMatchObject({ ok: true, archived: 1, copied: 2, bytes: 3 })
    expect(lines).toEqual(['  a.md', '  b/', '  [!] c: no'])
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ backupDir: '/arch', freeBytes: 9 }))
  })

  it('turns a native refusal into the same failed outcome', async () => {
    const { run } = engine([{ ...idle, outcome: { ...result, ok: false, refusal: { code: 'emptySource', count: 4 } } }])
    expect(await run(paths)).toMatchObject({ ok: false, copied: 0 })
  })

  it('counts every failed item, not only the retained messages', async () => {
    const { run } = engine([{ ...idle, outcome: { ...result, ok: false, failed: 7, errors: ['x: no'] } }])
    expect((await run(paths)).message).toContain('7')
  })

  it('cancels the native job when the backup is stopped and waits for its outcome', async () => {
    let active = true
    const { run, cancel } = engine([{ ...idle }, { ...idle, outcome: { ...result, ok: false, cancelled: true } }], { assertActive: () => { if (!active) throw new MirrorCancelled() } })
    const pending = run(paths)
    active = false
    expect(await pending).toMatchObject({ ok: false, cancelled: true })
    expect(cancel).toHaveBeenCalledOnce()
  })
})

describe('runRestore', () => {
  it('preflights dataset restore before files and restores datasets only after a successful file mirror', async () => {
    await write(join(dst(), 'restored.md'), 'from backup')
    await write(join(dst(), '.valley/settings/private.json'), 'excluded')
    const owned = mirrorFixture()
    owned.restoreExclusions = () => ['.valley/']
    const restore = vi.fn(async (_mapping: unknown, dryRun: boolean) => {
      expect(await fs.readFile(join(src(), 'restored.md'), 'utf8').catch(() => null)).toBe(dryRun ? null : 'from backup')
      return { stores: [{ pluginId: 'records', path: '.valley/plugins/data/records/data.sqlite' }], skipped: ['.valley/plugins/data/absent/data.sqlite'] }
    })
    const service = createMirrorService({ ...owned, restoreDatasets: restore })
    const out = await service.runRestore({ source: src(), destination: dst(), exclude: [] }, { dryRun: false })
    expect(restore.mock.calls.map(([, dryRun]) => dryRun)).toEqual([true, false])
    expect(out).toMatchObject({ ok: true, creates: ['restored.md'], updates: ['.valley/plugins/data/records/data.sqlite'], skipped: ['.valley/', '.valley/plugins/data/absent/data.sqlite'] })
    expect(await tree(src())).toEqual(['restored.md'])
  })

  it('does not copy files after snapshot validation fails or apply datasets after a failed mirror', async () => {
    await write(join(dst(), 'restored.md'), 'from backup')
    const invalid = vi.fn(async () => { throw new Error('Invalid snapshot') })
    await expect(createMirrorService({ ...mirrorFixture(), restoreDatasets: invalid }).runRestore({ source: src(), destination: dst(), exclude: [] }, { dryRun: false })).rejects.toThrow('Invalid snapshot')
    expect(await tree(src())).toEqual([])
    const restore = vi.fn(async () => ({ stores: [], skipped: [] }))
    const owned = mirrorFixture()
    const copy = vi.spyOn(owned.fs, 'copyFile').mockRejectedValue(new Error('Copy failed'))
    try {
      const out = await createMirrorService({ ...owned, restoreDatasets: restore }).runRestore({ source: src(), destination: dst(), exclude: [] }, { dryRun: false })
      expect(out.ok).toBe(false)
      expect(restore).toHaveBeenCalledOnce()
    } finally { copy.mockRestore() }
  })
  it('previews the reverse direction without writing', async () => {
    await write(join(dst(), 'restored.md'), 'from backup')

    const out = await runRestore({ source: src(), destination: dst(), exclude: [] }, { dryRun: true })

    expect(out.ok).toBe(true)
    expect(out.creates).toEqual(['restored.md'])
    expect(await tree(src())).toEqual([])
  })

  it('applies the reverse direction and escrows what it overwrites', async () => {
    await write(join(dst(), 'restored.md'), 'from backup')
    await write(join(src(), 'restored.md'), 'local edit to be escrowed')
    const escrowDir = join(root, 'restore-escrow')

    const out = await runRestore(
      { source: src(), destination: dst(), exclude: [] },
      { dryRun: false, escrowDir }
    )

    expect(out.ok).toBe(true)
    expect(out.updates).toEqual(['restored.md'])
    expect(await fs.readFile(join(src(), 'restored.md'), 'utf-8')).toBe('from backup')
    expect(await fs.readFile(join(escrowDir, 'restored.md'), 'utf-8')).toBe(
      'local edit to be escrowed'
    )
  })
})
