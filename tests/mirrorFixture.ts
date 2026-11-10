import { promises as filesystem } from 'node:fs'
import { join } from 'node:path'
import type { StorageFs } from '../src/backend/storageFs'

/** Listing entries shaped like `storage.list`: lstat kind, size and mtime. */
async function listing(path: string) {
  const entries = await filesystem.readdir(path, { withFileTypes: true })
  return Promise.all(entries.map(async (entry) => {
    const stat = await filesystem.lstat(join(path, entry.name))
    const kind = stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other'
    return { name: entry.name, kind, size: stat.size, mtimeMs: stat.mtimeMs, isDirectory: () => kind === 'directory', isFile: () => kind === 'file', isSymbolicLink: () => kind === 'symlink' }
  }))
}

export function mirrorFixture(assertActive = () => {}) {
  const fs = new Proxy(filesystem, {
    get(target, key) {
      if (key === 'assertActive') return assertActive
      if (key === 'commit') return (staged: string, path: string) => target.rename(staged, path)
      if (key === 'readdir') {
        return (path: string, options?: { withFileTypes?: boolean }) => {
          assertActive()
          return options?.withFileTypes ? listing(path) : target.readdir(path)
        }
      }
      const member = Reflect.get(target, key)
      return typeof member === 'function' ? (...args: unknown[]) => { assertActive(); return member(...args) } : member
    }
  }) as unknown as StorageFs
  return { fs, assertActive, prepareStorageSnapshots: async (_sources?: readonly string[]) => ({ stagingRoot: null, files: new Map<string, string>(), excluded: [] as string[] }), releaseStorageSnapshot: async () => {}, restoreExclusions: () => [] as string[], restoreDatasets: async () => ({ stores: [] as Array<{ pluginId: string; path: string }>, skipped: [] as string[] }) }
}
