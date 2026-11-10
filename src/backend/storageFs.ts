import { t } from './localization'
import type { PluginStorageApi, PluginStorageEntry, PluginStorageGrant, PluginStorageLocation } from '@valley/plugin-sdk/pluginStorage'
import type { MirrorMapping, MirrorPlan } from '../types'
import { CONFIG_DIR } from '@valley/plugin-sdk/paths'
import { dirname, normalize } from './path'
import { MirrorCancelled } from './jobLifetime'

const statObject = (entry: PluginStorageEntry) => ({ ...entry, isDirectory: () => entry.kind === 'directory', isFile: () => entry.kind === 'file', isSymbolicLink: () => entry.kind === 'symlink' })
export type StorageDirent = ReturnType<typeof statObject>
export type StorageFs = ReturnType<typeof createStorageSession>['fs']
export type StorageSession = ReturnType<typeof createStorageSession>

export function createStorageSession(storage: PluginStorageApi, signal?: AbortSignal) {
  let disposed = false
  let disposal: Promise<void> | undefined
  let cleanupFailed = false
  let cleanupFailure: unknown
  const pending = new Set<Promise<unknown>>()
  const assertActive = (): void => { if (disposed || signal?.aborted) throw new MirrorCancelled() }
  const accepted = <T>(operation: () => Promise<T>, phase: 'active' | 'finish' | 'cleanup' = 'active'): Promise<T> => {
    if (phase === 'active') assertActive()
    const task = (async () => operation())()
    pending.add(task)
    void task.then(() => pending.delete(task), error => {
      pending.delete(task)
      if (phase === 'cleanup' && !cleanupFailed) { cleanupFailed = true; cleanupFailure = error }
    })
    return task
  }
  const grants: PluginStorageGrant[] = []
  const snapshots = new Map<string, string>()
  let restoreRealm: PluginStorageGrant | undefined
  const missing = (path: string): Error => Object.assign(new Error(t('backend.storageMissing', { path })), { code: 'ENOENT' })
  const location = (path: string, write = false, finishing = false): PluginStorageLocation => {
    if (!finishing) assertActive()
    const normalized = normalize(path)
    const grant = grants.filter((entry) => (!write || entry.mode === 'write') && (normalized === normalize(entry.path) || (entry.kind === 'directory' && normalized.startsWith(normalize(entry.path) + '/')))).sort((a, b) => b.path.length - a.path.length)[0]
    if (!grant) throw new Error(t(write ? 'backend.writeGrant' : 'backend.readGrant', { path }))
    return { handle: grant.handle, path: normalized.slice(normalize(grant.path).length).replace(/^\//, '') }
  }

  async function authorizePlan(plan: MirrorPlan, operation: 'check' | 'run' | 'prune' | 'restorePlan' | 'restoreApply' | 'reveal'): Promise<void> {
    if (operation === 'restorePlan' || operation === 'restoreApply') {
      const grant = await accepted(() => storage.open({ area: 'realm', path: '', kind: 'directory', mode: operation === 'restoreApply' ? 'write' : 'read' }))
      grants.push(grant)
      restoreRealm = grant
      assertActive()
    }
    const requested: Array<{ path: string; kind: 'file' | 'directory'; mode: 'read' | 'write' }> = []
    for (const mapping of plan.mappings) {
      requested.push({ path: mapping.source, kind: 'directory', mode: operation === 'restoreApply' ? 'write' : 'read' })
      requested.push({ path: mapping.destination, kind: 'directory', mode: ['run', 'prune', 'restoreApply'].includes(operation) ? 'write' : 'read' })
    }
    const write = ['run', 'prune', 'restoreApply'].includes(operation)
    // A switched-off archive or log must not block a run because its drive is away.
    // Retention and restores still reach an existing archive folder.
    const archiveUnused = plan.noArchive && !plan.retention && (operation === 'run' || operation === 'check')
    for (const path of [archiveUnused ? '' : plan.trashPath, plan.noLogs ? '' : plan.logDirectory]) if (path) requested.push({ path, kind: 'directory', mode: write ? 'write' : 'read' })
    if (plan.masterLog && !plan.noLogs) requested.push({ path: plan.masterLog, kind: 'file', mode: write ? 'write' : 'read' })
    for (const input of requested) {
      assertActive()
      const path = normalize(input.path)
      if (!grants.some((grant) => normalize(grant.path) === path && grant.mode === input.mode && grant.kind === input.kind)) grants.push(await accepted(() => storage.open({ ...input, path, area: 'external' })))
      assertActive()
    }
  }

  const storageFs = {
    assertActive,
    async access(path: string): Promise<void> {
      try { if (!await accepted(() => storage.stat(location(path)))) throw missing(path) }
      catch (error) { if (error instanceof MirrorCancelled) throw error; if (!grants.some((grant) => grant.ancestors?.map(normalize).includes(normalize(path)))) throw error }
    },
    async stat(path: string) { const entry = await accepted(() => storage.stat(location(path))); if (!entry) throw missing(path); return statObject(entry) },
    async lstat(path: string) { return this.stat(path) },
    readdir,
    async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
      assertActive()
      if (grants.some((grant) => grant.kind === 'file' && dirname(normalize(grant.path)) === normalize(path))) return
      await accepted(() => storage.mkdir(location(path, true)))
    },
    async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> { await accepted(() => storage.remove(location(path, true), { recursive: options?.recursive, missingOk: options?.force })) },
    async rmdir(path: string): Promise<void> { await accepted(() => storage.remove(location(path, true))) },
    async readlink(path: string): Promise<string> { return accepted(() => storage.readLink(location(path))) },
    async symlink(target: string, path: string, _type?: string): Promise<void> { await accepted(() => storage.link(location(path, true), target)) },
    async rename(source: string, destination: string): Promise<void> { await accepted(() => storage.move(location(source, true), location(destination, true))) },
    /** Renames a finished copy into place. A stop must not strand bytes the host already wrote under their staged name. */
    async commit(staged: string, target: string): Promise<void> { await accepted(() => storage.move(location(staged, true, true), location(target, true, true)), 'finish') },
    async cp(source: string, destination: string, _options?: { recursive?: boolean; force?: boolean }): Promise<void> { await accepted(() => storage.copy(location(source), location(destination, true))) },
    async copyFile(source: string, destination: string): Promise<void> { await accepted(() => storage.copy(location(source), location(destination, true))) },
    async utimes(path: string, _accessed: Date, modified: Date): Promise<void> { await accepted(() => storage.setTimes(location(path, true), modified.getTime())) },
    async writeFile(path: string, text: string, _encoding?: string): Promise<void> { await accepted(() => storage.write(location(path, true), text)) },
    async appendFile(path: string, text: string): Promise<void> { await accepted(() => storage.write(location(path, true), text, true)) }
  }

  let realmPath: Promise<string> | undefined
  const activeRealm = (): Promise<string> => realmPath ??= (async () => {
    if (restoreRealm) return restoreRealm.path
    const grant = await accepted(() => storage.open({ area: 'realm', path: '', kind: 'directory', mode: 'read' }))
    grants.push(grant)
    assertActive()
    return grant.path
  })()
  /**
   * Stage consistent dataset copies, but only for a plan that actually carries
   * them: a source holding the realm's configuration folder. A backup of any
   * other folder never touches the realm's databases, so a busy or migrating
   * store elsewhere cannot fail it.
   */
  async function prepareStorageSnapshots(sources: readonly string[]): Promise<{ stagingRoot: string | null; files: Map<string, string>; excluded: string[] }> {
    const config = normalize(`${await activeRealm()}/${CONFIG_DIR}`).toLowerCase()
    const carriesRealm = sources.some((source) => {
      const root = normalize(source).toLowerCase()
      return config === root || config.startsWith(`${root.replace(/\/$/, '')}/`)
    })
    if (!carriesRealm) return { stagingRoot: null, files: new Map(), excluded: [] }
    const snapshot = await accepted(() => storage.snapshotDatasets())
    const stagingRoot = `/snapshot/${snapshot.handle}`
    grants.push({ handle: snapshot.handle, path: stagingRoot, kind: 'directory', mode: 'read' })
    snapshots.set(stagingRoot, snapshot.handle)
    return { stagingRoot, files: new Map(snapshot.files.map((file) => [file.original, `${stagingRoot}/${file.path}`])), excluded: snapshot.excluded }
  }
  async function releaseStorageSnapshot(root: string): Promise<void> {
    const handle = snapshots.get(root)
    if (!handle) return
    snapshots.delete(root)
    const index = grants.findIndex((grant) => grant.handle === handle)
    if (index >= 0) grants.splice(index, 1)
    await accepted(() => storage.close(handle), 'cleanup')
  }
  async function revealStorage(path: string): Promise<void> { await accepted(() => storage.reveal(location(path))) }
  const restoringRealm = (mapping: MirrorMapping): boolean => Boolean(restoreRealm && normalize(mapping.source) === normalize(restoreRealm.path))
  const restoreExclusions = (mapping: MirrorMapping): string[] => restoringRealm(mapping) ? [`${CONFIG_DIR}/`] : []
  async function restoreDatasets(mapping: MirrorMapping, dryRun: boolean) {
    if (!restoringRealm(mapping)) return { stores: [], skipped: [] }
    return accepted(() => storage.restoreDatasets({ source: location(mapping.destination), target: { handle: restoreRealm!.handle, path: '' }, dryRun }))
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal
    disposed = true
    return disposal = (async () => {
      while (pending.size) await Promise.allSettled([...pending])
      const results = await Promise.allSettled(grants.splice(0).map((grant) => accepted(() => storage.close(grant.handle), 'cleanup')))
      snapshots.clear()
      if (cleanupFailed) throw cleanupFailure
      const failure = results.find((result) => result.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    })()
  }

  function readdir(path: string, options: { withFileTypes: true }): Promise<StorageDirent[]>
  function readdir(path: string, options?: { withFileTypes?: false }): Promise<string[]>
  async function readdir(path: string, options?: { withFileTypes?: boolean }): Promise<StorageDirent[] | string[]> {
    const entries = await accepted(() => storage.list(location(path)))
    return options?.withFileTypes ? entries.map(statObject) : entries.map((entry) => entry.name)
  }

  return { fs: storageFs, authorizePlan, prepareStorageSnapshots, releaseStorageSnapshot, revealStorage, restoreExclusions, restoreDatasets, assertActive, dispose }
}
