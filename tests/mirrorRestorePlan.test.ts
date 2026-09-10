import { vi } from 'vitest'
vi.mock('../src/backend/storageFs', async () => ({ storageFs: (await import('node:fs')).promises, prepareStorageSnapshots: async () => ({ stagingRoot: null, files: new Map() }), releaseStorageSnapshot: async () => {} }))
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { deletionRoots, mirrorTree } from '../src/backend/mirror'
import { runRestore } from '../src/backend/mirrorService'

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
      percents.push(p)
    )

    expect(percents.at(-1)).toBe(100)
    expect(percents.every((p) => p >= 0 && p <= 100)).toBe(true)
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

describe('deletionRoots', () => {
  it('collapses a fully doomed subtree to its topmost entry', () => {
    const deletes = ['gone/a/b/deep.md', 'gone/a/b', 'gone/a', 'gone', 'gone/top.md']

    expect(deletionRoots(deletes, deletes)).toEqual([{ rel: 'gone', entries: 5 }])
  })

  it('keeps a directory that holds a survivor, and removes its doomed children one by one', () => {
    const dest = ['stale/junk.md', 'stale/notes.keep', 'stale/sub/x.md', 'stale/sub', 'stale']
    const deletes = ['stale/sub/x.md', 'stale/sub', 'stale/junk.md', 'stale']

    // `stale` survives (it holds the excluded `notes.keep`), so its doomed
    // children are removed individually — `sub` still collapsing as a unit.
    expect(deletionRoots(deletes, dest)).toEqual([
      { rel: 'stale/junk.md', entries: 1 },
      { rel: 'stale/sub', entries: 2 }
    ])
  })

  it('accounts for every removed entry exactly once', () => {
    const dest = ['a', 'a/x.md', 'b', 'b/c', 'b/c/y.md', 'keep.md']
    const deletes = ['a', 'a/x.md', 'b', 'b/c', 'b/c/y.md']

    const roots = deletionRoots(deletes, dest)

    expect(roots.map((r) => r.rel)).toEqual(['a', 'b'])
    expect(roots.reduce((sum, r) => sum + r.entries, 0)).toBe(deletes.length)
  })
})

describe('runRestore', () => {
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
