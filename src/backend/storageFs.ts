import { t } from './localization'
import type { PluginStorageApi, PluginStorageEntry, PluginStorageGrant, PluginStorageLocation } from '@valley/plugin-sdk/pluginStorage'
import type { MirrorPlan } from '../types'
import { dirname, normalize } from './path'

let storage: PluginStorageApi
const grants: PluginStorageGrant[] = []
const snapshots = new Map<string, string>()
const missing = (path: string): Error => Object.assign(new Error(t('backend.storageMissing', { path })), { code: 'ENOENT' })
export type StorageDirent = ReturnType<typeof statObject>
const statObject = (entry: PluginStorageEntry) => ({ ...entry, isDirectory: () => entry.kind === 'directory', isFile: () => entry.kind === 'file', isSymbolicLink: () => entry.kind === 'symlink' })
const location = (path: string, write = false): PluginStorageLocation => {
  const normalized = normalize(path)
  const grant = grants.filter((entry) => (!write || entry.mode === 'write') && (normalized === normalize(entry.path) || (entry.kind === 'directory' && normalized.startsWith(normalize(entry.path) + '/')))).sort((a, b) => b.path.length - a.path.length)[0]
  if (!grant) throw new Error(t(write ? 'backend.writeGrant' : 'backend.readGrant', { path }))
  return { handle: grant.handle, path: normalized.slice(normalize(grant.path).length).replace(/^\//, '') }
}

export function bindStorage(api: PluginStorageApi): void { storage = api }
export async function authorizePlan(plan: MirrorPlan, operation: 'check' | 'run' | 'prune' | 'restorePlan' | 'restoreApply' | 'reveal'): Promise<void> {
  const requested: Array<{ path: string; kind: 'file' | 'directory'; mode: 'read' | 'write' }> = []
  for (const mapping of plan.mappings) {
    requested.push({ path: mapping.source, kind: 'directory', mode: operation === 'restoreApply' ? 'write' : 'read' })
    requested.push({ path: mapping.destination, kind: 'directory', mode: ['run', 'prune', 'restoreApply'].includes(operation) ? 'write' : 'read' })
  }
  const write = ['run', 'prune', 'restoreApply'].includes(operation)
  for (const path of [plan.trashPath, plan.logDirectory]) if (path) requested.push({ path, kind: 'directory', mode: write ? 'write' : 'read' })
  if (plan.masterLog) requested.push({ path: plan.masterLog, kind: 'file', mode: write ? 'write' : 'read' })
  for (const input of requested) {
    const path = normalize(input.path)
    if (!grants.some((grant) => normalize(grant.path) === path && grant.mode === input.mode && grant.kind === input.kind)) grants.push(await storage.open({ ...input, path, area: 'external' }))
  }
}

export const storageFs = {
  async access(path: string): Promise<void> {
    try { if (!await storage.stat(location(path))) throw missing(path) }
    catch (error) { if (!grants.some((grant) => grant.ancestors?.map(normalize).includes(normalize(path)))) throw error }
  },
  async stat(path: string) { const entry = await storage.stat(location(path)); if (!entry) throw missing(path); return statObject(entry) },
  async lstat(path: string) { return this.stat(path) },
  readdir,
  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    if (grants.some((grant) => grant.kind === 'file' && dirname(normalize(grant.path)) === normalize(path))) return
    await storage.mkdir(location(path, true))
  },
  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> { await storage.remove(location(path, true), { recursive: options?.recursive, missingOk: options?.force }) },
  async rmdir(path: string): Promise<void> { await storage.remove(location(path, true)) },
  async readlink(path: string): Promise<string> { return storage.readLink(location(path)) },
  async symlink(target: string, path: string, _type?: string): Promise<void> { await storage.link(location(path, true), target) },
  async rename(source: string, destination: string): Promise<void> { await storage.move(location(source, true), location(destination, true)) },
  async cp(source: string, destination: string, _options?: { recursive?: boolean; force?: boolean }): Promise<void> { await storage.copy(location(source), location(destination, true)) },
  async copyFile(source: string, destination: string): Promise<void> { await storage.copy(location(source), location(destination, true)) },
  async utimes(path: string, _accessed: Date, modified: Date): Promise<void> { await storage.setTimes(location(path, true), modified.getTime()) },
  async writeFile(path: string, text: string, _encoding?: string): Promise<void> { await storage.write(location(path, true), text) },
  async appendFile(path: string, text: string): Promise<void> { await storage.write(location(path, true), text, true) }
}

export async function prepareStorageSnapshots(): Promise<{ stagingRoot: string | null; files: Map<string, string>; excluded: string[] }> {
  const snapshot = await storage.snapshotDatasets()
  const stagingRoot = `/snapshot/${snapshot.handle}`
  grants.push({ handle: snapshot.handle, path: stagingRoot, kind: 'directory', mode: 'read' })
  snapshots.set(stagingRoot, snapshot.handle)
  return { stagingRoot, files: new Map(snapshot.files.map((file) => [file.original, `${stagingRoot}/${file.path}`])), excluded: snapshot.excluded }
}
export async function releaseStorageSnapshot(root: string): Promise<void> {
  const handle = snapshots.get(root)
  if (!handle) return
  snapshots.delete(root)
  const index = grants.findIndex((grant) => grant.handle === handle)
  if (index >= 0) grants.splice(index, 1)
  await storage.close(handle)
}
export async function revealStorage(path: string): Promise<void> { await storage.reveal(location(path)) }
export async function releaseStorage(): Promise<void> {
  await Promise.all(grants.splice(0).map((grant) => storage.close(grant.handle)))
  snapshots.clear()
}

function readdir(path: string, options: { withFileTypes: true }): Promise<StorageDirent[]>
function readdir(path: string, options?: { withFileTypes?: false }): Promise<string[]>
async function readdir(path: string, options?: { withFileTypes?: boolean }): Promise<StorageDirent[] | string[]> {
  const entries = await storage.list(location(path))
  return options?.withFileTypes ? entries.map(statObject) : entries.map((entry) => entry.name)
}
