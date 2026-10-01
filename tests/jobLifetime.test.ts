import Ajv from 'ajv'
import config from '../config.json'
import { createHistoryStore } from '../src/history'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { promises as filesystem } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createMockValleyApi } from '@valley/plugin-testkit'
import type { PluginStorageApi, PluginStorageGrant } from '@valley/plugin-sdk/pluginStorage'
import type { PluginBackendApi, PluginBackendOperationContext } from '@valley/plugin-sdk'
import { MirrorCancelled, MirrorJobs } from '../src/backend/jobLifetime'
import { createStorageSession } from '../src/backend/storageFs'
import { createMirrorService } from '../src/backend/mirrorService'
import { createMirrorEngine } from '../src/backend/mirror'
import { register } from '../src/backend/index'
import { backupApi } from '../src/backupApi'
import { createBackupOperations } from '../src/commands'
import { createProfileStore } from '../src/profiles'
import { mirrorFixture } from './mirrorFixture'

const outputSchemas = new Map(config.runtime.services.map(service => [service.method, new Ajv({ strict: false, strictSchema: true, allErrors: true, validateFormats: false, allowUnionTypes: true, ownProperties: true }).compile(service.metadata.command.outputSchema)]))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function turns() { for (let i = 0; i < 12; i++) await Promise.resolve() }
const plan = () => ({ label: 'Fixture', mappings: [{ source: '/fixtures/source', destination: '/fixtures/destination', exclude: [] as string[] }], trashPath: '', logDirectory: '', masterLog: '', retention: null })
const runIdentity = () => ({ id: crypto.randomUUID(), startedAt: new Date().toISOString(), profileId: 'fixture', profileName: 'Fixture', trigger: 'manual' })
const completed = { ok: true, mappings: 1, archived: 2, durationSec: 1, errors: 0 }

function storageMock() {
  let id = 0
  const api: PluginStorageApi = {
    open: vi.fn(async (input) => ({ ...input, path: input.area === 'vault' ? '/fixtures/active-vault' : input.path, handle: `grant-${++id}` })),
    close: vi.fn(async () => {}),
    stat: vi.fn(async () => ({ name: 'fixture', kind: 'directory' as const, size: 0, mtimeMs: 0 })),
    list: vi.fn(async () => []), read: vi.fn(async () => ''),
    readDocument: vi.fn(async () => { throw new Error('Unused fixture operation') }),
    writeDocument: vi.fn(async () => { throw new Error('Unused fixture operation') }),
    writeDocuments: vi.fn(async () => { throw new Error('Unused fixture operation') }),
    readBytes: vi.fn(async () => ({ base64: '', nextOffset: 0, done: true })),
    importFile: vi.fn(async () => {}), exportFile: vi.fn(async () => { throw new Error('Unused fixture operation') }),
    writeBytes: vi.fn(async () => {}),
    write: vi.fn(async () => {}), mkdir: vi.fn(async () => {}),
    remove: vi.fn(async () => {}), copy: vi.fn(async () => {}), move: vi.fn(async () => {}),
    readLink: vi.fn(async () => ''), link: vi.fn(async () => {}), setTimes: vi.fn(async () => {}),
    reveal: vi.fn(async () => {}), snapshotDatasets: vi.fn(async () => ({ handle: 'snapshot', files: [], excluded: [] })),
    restoreDatasets: vi.fn(async () => ({ stores: [], skipped: [] }))
  }
  return api
}

function backend(storage = storageMock()) {
  const handlers = new Map<string, (payload: unknown) => unknown>()
  const operations = new Map<string, (payload: unknown, context: PluginBackendOperationContext) => unknown>()
  const ambient = storageMock()
  const emit = vi.fn()
  const mock = createMockValleyApi({ manifest: { id: 'backup' } })
  const api = {
    data: mock.api.data, notifications: mock.api.notifications, settings: mock.api.settings, lifecycle: { onResume: () => () => {} },
    pluginId: 'backup', storage: ambient,
    rpc: {
      handle: (method: string, handler: (payload: unknown) => unknown) => { handlers.set(method, handler); return () => { handlers.delete(method) } },
      handleOperation: (method: string, handler: (payload: unknown, context: PluginBackendOperationContext) => unknown) => { operations.set(method, handler); return () => { operations.delete(method) } },
      emit: vi.fn()
    },
    i18n: { t: (key: string) => key, language: () => 'en', onLanguageChanged: () => () => {} }
  } as unknown as PluginBackendApi
  const dispose = register(api)
  const context = (controller = new AbortController()): PluginBackendOperationContext => ({ id: crypto.randomUUID(), cancellation: controller.signal, api: { ...api, storage, rpc: { emit } } })
  return { api, storage, ambient, emit, handlers, operations, context, dispose,
    invoke: async (method: string, payload?: unknown, owner = context()) => { const result = await (operations.has(method) ? operations.get(method)!(payload, owner) : handlers.get(method)!(payload)); const validate = outputSchemas.get(method); if (validate) expect(validate(result), JSON.stringify(validate.errors)).toBe(true); return result } }
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('bounded backup job ownership', () => {
  it('validates all command result shapes against the actual mocked-storage backend', async () => {
    const owned = backend()
    try {
      for (const method of ['check', 'prune', 'restorePlan', 'restoreApply', 'run']) {
        await owned.invoke(method, { plan: plan(), ...(method === 'run' ? { identity: runIdentity() } : method === 'prune' ? { dryRun: true } : method.startsWith('restore') ? { mappingIndex: 0 } : {}) })
        expect(outputSchemas.get(method)!({}), method).toBe(false)
      }
    } finally { await owned.dispose() }
  })

  it('rejects cancellation before dispatch and bounds retained accepted jobs', async () => {
    const jobs = new MirrorJobs()
    const controller = new AbortController()
    controller.abort()
    const effect = vi.fn(async () => true)
    await expect(jobs.run(controller.signal, effect)).rejects.toBeInstanceOf(MirrorCancelled)
    expect(effect).not.toHaveBeenCalled()
    const held = deferred<void>()
    const pending = Array.from({ length: 32 }, () => jobs.run(undefined, () => held.promise))
    await expect(jobs.run(undefined, effect)).rejects.toThrow('Too many')
    held.resolve()
    await Promise.all(pending)
    expect(await jobs.run(undefined, effect)).toBe(true)
    await jobs.dispose()
    await expect(jobs.run(undefined, effect)).rejects.toBeInstanceOf(MirrorCancelled)
  })

  it('cancels immediately but joins an accepted task before repeated disposal settles', async () => {
    const jobs = new MirrorJobs()
    const held = deferred<number>()
    const entered = deferred<void>()
    let signal!: AbortSignal
    const task = jobs.run(undefined, (value) => { signal = value; entered.resolve(); return held.promise })
    await entered.promise
    let settled = false
    const draining = jobs.dispose()
    expect(jobs.dispose()).toBe(draining)
    const disposal = draining.then(() => { settled = true })
    expect(signal.aborted).toBe(true)
    await turns()
    expect(settled).toBe(false)
    held.resolve(17)
    expect(await task).toBe(17)
    await disposal
  })

  it('joins authorization then closes its originating grant without opening another path', async () => {
    const owned = backend()
    const held = deferred<PluginStorageGrant>()
    const entered = deferred<void>()
    vi.mocked(owned.storage.open).mockImplementation(() => { entered.resolve(); return held.promise })
    const controller = new AbortController()
    const task = owned.invoke('run', { plan: plan(), identity: runIdentity() }, owned.context(controller))
    const rejected = expect(task).rejects.toBeInstanceOf(MirrorCancelled)
    await entered.promise
    let settled = false
    controller.abort()
    const cancelled = owned.dispose().then(() => { settled = true })
    const peer = backend()
    await turns()
    expect(settled).toBe(false)
    expect(owned.storage.close).not.toHaveBeenCalled()
    held.resolve({ handle: 'original-grant', path: '/fixtures/source', mode: 'read', kind: 'directory' })
    await rejected
    await cancelled
    expect(owned.storage.open).toHaveBeenCalledOnce()
    expect(owned.storage.close).toHaveBeenCalledOnce()
    expect(owned.storage.close).toHaveBeenCalledWith('original-grant')
    expect(peer.storage.close).not.toHaveBeenCalled()
    expect(owned.ambient.open).not.toHaveBeenCalled()
    await Promise.all([owned.dispose(), peer.dispose()])
  })

  it('retains completed archive counts when closing the original grants fails', async () => {
    const owned = backend()
    vi.mocked(owned.storage.stat).mockImplementation(async (location) => ({ name: location.path, kind: location.path === 'gone.txt' ? 'file' : 'directory', size: 1, mtimeMs: 0 }))
    vi.mocked(owned.storage.list).mockImplementation(async (location) => location.handle === 'grant-2' && !location.path ? [{ name: 'gone.txt', kind: 'file', size: 1, mtimeMs: 0 }] : [])
    vi.mocked(owned.storage.close).mockRejectedValue(new Error('Grant release failed'))
    const result = await owned.invoke('run', { plan: plan(), identity: runIdentity() })
    expect(result).toMatchObject({ ok: false, archived: 1, mappings: 1, message: 'Grant release failed' })
    expect(owned.storage.move).toHaveBeenCalledOnce()
    await owned.dispose()
  })

  it('reports a failed snapshot close after draining remaining grants without replay', async () => {
    const owned = backend()
    vi.mocked(owned.storage.stat).mockImplementation(async (location) => ({ name: location.path, kind: location.path === 'gone.txt' ? 'file' : 'directory', size: 1, mtimeMs: 0 }))
    vi.mocked(owned.storage.list).mockImplementation(async (location) => location.handle === 'grant-2' && !location.path ? [{ name: 'gone.txt', kind: 'file', size: 1, mtimeMs: 0 }] : [])
    vi.mocked(owned.storage.close).mockImplementation(async handle => { if (handle === 'snapshot') throw new Error('Snapshot close outcome unknown') })
    const vaultPlan = plan()
    vaultPlan.mappings[0].source = '/fixtures/active-vault'
    expect(await owned.invoke('run', { plan: vaultPlan, identity: runIdentity() })).toMatchObject({ ok: false, archived: 1, mappings: 1, message: 'Snapshot close outcome unknown' })
    expect(owned.storage.move).toHaveBeenCalledOnce()
    expect(vi.mocked(owned.storage.close).mock.calls.map(([handle]) => handle)).toEqual(['snapshot', 'grant-1', 'grant-2', 'grant-3'])
    await owned.dispose()
    expect(owned.storage.close).toHaveBeenCalledTimes(4)
  })

  it('snapshots datasets only for a source that carries the vault configuration', async () => {
    const owned = backend()
    expect(await owned.invoke('run', { plan: plan(), identity: runIdentity() })).toMatchObject({ ok: true, mappings: 1 })
    expect(owned.storage.snapshotDatasets).not.toHaveBeenCalled()
    const parent = plan()
    parent.mappings[0].source = '/fixtures'
    parent.mappings[0].destination = '/backups/destination'
    expect(await owned.invoke('run', { plan: parent, identity: runIdentity() })).toMatchObject({ ok: true, mappings: 1 })
    expect(owned.storage.snapshotDatasets).toHaveBeenCalledOnce()
    await owned.dispose()
  })

  it('rejects saved backend callbacks after disposal before acquiring a grant', async () => {
    const owned = backend()
    const run = owned.operations.get('run')!
    await owned.dispose()
    await expect(run({ plan: plan() }, owned.context())).rejects.toBeInstanceOf(MirrorCancelled)
    expect(owned.storage.open).not.toHaveBeenCalled()
  })

  it('registers every long operation only on the owned contract and rejects malformed or replayed contexts', async () => {
    const owned = backend()
    expect([...owned.operations.keys()]).toEqual(['check', 'run', 'prune', 'restorePlan', 'restoreApply'])
    expect([...owned.handlers.keys()]).toEqual(['reveal', 'schedule.snapshot'])
    const run = owned.operations.get('run')!
    const valid = owned.context()
    for (const invalid of [undefined, { ...valid, id: '' }, { ...valid, cancellation: {} }, { ...valid, api: { ...valid.api, pluginId: 'other' } }, { ...valid, api: {} }]) {
      await expect(async () => run({ plan: plan() }, invalid as PluginBackendOperationContext)).rejects.toThrow('Invalid backup operation context')
    }
    expect(owned.storage.open).not.toHaveBeenCalled()
    const controller = new AbortController()
    controller.abort()
    await expect(owned.invoke('run', { plan: plan(), identity: runIdentity() }, owned.context(controller))).rejects.toBeInstanceOf(MirrorCancelled)
    expect(owned.storage.open).not.toHaveBeenCalled()
    expect(await owned.invoke('run', { plan: plan(), identity: runIdentity() }, valid)).toMatchObject({ ok: true, mappings: 1 })
    const calls = vi.mocked(owned.storage.open).mock.calls.length
    await expect(async () => run({ plan: plan() }, valid)).rejects.toThrow('already dispatched')
    expect(owned.storage.open).toHaveBeenCalledTimes(calls)
    await owned.dispose()
  })

  it.each(['check', 'prune', 'restorePlan', 'restoreApply'] as const)('joins cancelled %s authorization on its accepted API before closing', async method => {
    const owned = backend()
    const opened = deferred<PluginStorageGrant>(), entered = deferred<void>(), closed = deferred<void>()
    vi.mocked(owned.storage.open).mockImplementation(() => { entered.resolve(); return opened.promise })
    vi.mocked(owned.storage.close).mockReturnValue(closed.promise)
    const controller = new AbortController()
    const task = owned.invoke(method, { plan: plan(), ...(method.startsWith('restore') ? { mappingIndex: 0 } : {}) }, owned.context(controller))
    const rejected = expect(task).rejects.toBeInstanceOf(MirrorCancelled)
    await entered.promise
    controller.abort()
    let settled = false
    const disposing = owned.dispose().then(() => { settled = true })
    opened.resolve({ handle: 'accepted-grant', path: '/fixtures/source', mode: 'read', kind: 'directory' })
    await turns()
    expect(owned.storage.close).toHaveBeenCalledWith('accepted-grant')
    expect(settled).toBe(false)
    expect(owned.ambient.open).not.toHaveBeenCalled()
    expect(owned.ambient.close).not.toHaveBeenCalled()
    closed.resolve()
    await rejected
    await disposing
    expect(owned.storage.open).toHaveBeenCalledOnce()
    expect(owned.storage.close).toHaveBeenCalledOnce()
  })

  it('retains the final result beyond 150 seconds while accepted final writes and storage closure drain', async () => {
    vi.useFakeTimers()
    const owned = backend()
    const wrote = deferred<void>(), write = deferred<void>(), snapshotClose = deferred<void>(), grantsClose = deferred<void>()
    vi.mocked(owned.storage.write).mockImplementation(async () => { if (vi.mocked(owned.storage.write).mock.calls.length === 2) wrote.resolve(); await write.promise })
    vi.mocked(owned.storage.close).mockImplementation(async handle => { await (handle === 'snapshot' ? snapshotClose.promise : grantsClose.promise) })
    const controller = new AbortController()
    let settled = false, drained = false
    const vaultPlan = { ...plan(), logDirectory: '/fixtures/logs', masterLog: '/fixtures/master.log' }
    vaultPlan.mappings[0].source = '/fixtures/active-vault'
    const task = owned.invoke('run', { plan: vaultPlan, identity: runIdentity() }, owned.context(controller)).finally(() => { settled = true })
    await wrote.promise
    await vi.advanceTimersByTimeAsync(150_000)
    expect(settled).toBe(false)
    expect(owned.storage.write).toHaveBeenCalledTimes(2)
    const emitted = owned.emit.mock.calls.length
    controller.abort()
    const disposing = owned.dispose().then(() => { drained = true })
    write.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(owned.storage.close).toHaveBeenCalledWith('snapshot')
    expect(settled).toBe(false)
    expect(drained).toBe(false)
    snapshotClose.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(owned.storage.close).toHaveBeenCalledTimes(6)
    await vi.advanceTimersByTimeAsync(150_000)
    expect(settled).toBe(false)
    expect(drained).toBe(false)
    grantsClose.resolve()
    expect(await task).toMatchObject({ ok: true, mappings: 1, archived: 0, errors: 0 })
    await disposing
    expect(owned.emit).toHaveBeenCalledTimes(emitted)
    expect(owned.ambient.open).not.toHaveBeenCalled()
    expect(owned.storage.write).toHaveBeenCalledTimes(2)
    expect(owned.storage.close).toHaveBeenCalledTimes(6)
  })

  it('keeps the exclusive guard through accepted closure and permits an independent check', async () => {
    const owned = backend()
    const held = deferred<void>(), entered = deferred<void>()
    vi.mocked(owned.storage.close).mockImplementationOnce(async () => { entered.resolve(); await held.promise })
    const running = owned.invoke('run', { plan: plan(), identity: runIdentity() })
    await entered.promise
    await expect(owned.invoke('prune', { plan: plan() })).rejects.toThrow('running')
    expect(await owned.invoke('check', { plan: plan() })).toMatchObject({ ok: true })
    held.resolve()
    expect(await running).toMatchObject({ ok: true })
    expect(await owned.invoke('prune', { plan: plan(), dryRun: true })).toMatchObject({ errors: [] })
    await owned.dispose()
  })
})

describe('backup storage drain', () => {
  it('uses the captured vault grant for dataset restore and joins accepted work before disposal', async () => {
    const api = storageMock()
    const owner = createStorageSession(api)
    const acceptedPlan = plan()
    acceptedPlan.mappings[0].source = '/fixtures/active-vault'
    await owner.authorizePlan(acceptedPlan, 'restoreApply')
    expect(vi.mocked(api.open).mock.calls).toEqual([
      [{ area: 'vault', path: '', kind: 'directory', mode: 'write' }],
      [{ area: 'external', path: '/fixtures/destination', kind: 'directory', mode: 'write' }]
    ])
    expect(owner.restoreExclusions(acceptedPlan.mappings[0])).toEqual(['.valley/'])
    const held = deferred<Awaited<ReturnType<typeof api.restoreDatasets>>>()
    vi.mocked(api.restoreDatasets).mockReturnValue(held.promise)
    const restore = owner.restoreDatasets(acceptedPlan.mappings[0], false)
    expect(api.restoreDatasets).toHaveBeenCalledOnce()
    expect(api.restoreDatasets).toHaveBeenCalledWith({ source: { handle: 'grant-2', path: '' }, target: { handle: 'grant-1', path: '' }, dryRun: false })
    let disposed = false
    const disposal = owner.dispose().then(() => { disposed = true })
    await turns(); expect(disposed).toBe(false); expect(api.close).not.toHaveBeenCalled()
    held.resolve({ stores: [{ pluginId: 'records', path: '.valley/plugins/data/records/data.sqlite' }], skipped: [] })
    await restore; await disposal
    expect(api.close).toHaveBeenCalledTimes(2)
  })

  it('leaves external-folder restore behavior unchanged and never restores its databases', async () => {
    const api = storageMock()
    const owner = createStorageSession(api)
    await owner.authorizePlan(plan(), 'restoreApply')
    expect(owner.restoreExclusions(plan().mappings[0])).toEqual([])
    expect(await owner.restoreDatasets(plan().mappings[0], false)).toEqual({ stores: [], skipped: [] })
    expect(api.restoreDatasets).not.toHaveBeenCalled()
    await owner.dispose()
  })

  it('waits for accepted copies before closing handles and blocks subsequent work', async () => {
    const api = storageMock()
    const owner = createStorageSession(api)
    await owner.authorizePlan(plan(), 'run')
    const held = deferred<void>()
    vi.mocked(api.copy).mockReturnValue(held.promise)
    const copy = owner.fs.copyFile('/fixtures/source/a', '/fixtures/destination/a')
    let settled = false
    const draining = owner.dispose().then(() => { settled = true })
    await expect(owner.fs.copyFile('/fixtures/source/b', '/fixtures/destination/b')).rejects.toBeInstanceOf(MirrorCancelled)
    await turns()
    expect(settled).toBe(false)
    expect(api.close).not.toHaveBeenCalled()
    held.resolve()
    await copy
    await draining
    expect(api.copy).toHaveBeenCalledOnce()
    expect(api.close).toHaveBeenCalledTimes(2)
  })

  it('releases a snapshot that resolves after disposal exactly once', async () => {
    const api = storageMock()
    const owner = createStorageSession(api)
    const held = deferred<Awaited<ReturnType<typeof api.snapshotDatasets>>>()
    vi.mocked(api.snapshotDatasets).mockReturnValue(held.promise)
    const snapshot = owner.prepareStorageSnapshots(['/fixtures/active-vault'])
    await vi.waitFor(() => expect(api.snapshotDatasets).toHaveBeenCalledOnce())
    const draining = owner.dispose()
    held.resolve({ handle: 'late-snapshot', files: [], excluded: [] })
    await snapshot
    await draining
    expect(vi.mocked(api.close).mock.calls.map(([handle]) => handle)).toEqual(['grant-1', 'late-snapshot'])
    await owner.releaseStorageSnapshot('/snapshot/late-snapshot')
    expect(api.close).toHaveBeenCalledTimes(2)
  })

  it('joins every accepted close even when one fails, without retrying uncertain releases', async () => {
    const api = storageMock()
    const owner = createStorageSession(api)
    await owner.authorizePlan(plan(), 'run')
    const held = deferred<void>()
    vi.mocked(api.close).mockRejectedValueOnce(new Error('Close outcome unknown')).mockReturnValueOnce(held.promise)
    let settled = false
    const disposal = owner.dispose().finally(() => { settled = true })
    const rejected = expect(disposal).rejects.toThrow('Close outcome unknown')
    await turns()
    expect(settled).toBe(false)
    held.resolve()
    await rejected
    await expect(owner.dispose()).rejects.toThrow('Close outcome unknown')
    expect(api.close).toHaveBeenCalledTimes(2)
  })
})

describe('mirror cancellation preserves accepted effects', () => {
  it('keeps archived material and the accepted copies, starts no later files and skips retention', async () => {
    const root = await filesystem.mkdtemp(join(tmpdir(), 'backup-cancel-'))
    const source = join(root, 'source'), destination = join(root, 'destination'), trash = join(root, 'trash')
    const controller = new AbortController()
    const fixture = mirrorFixture(() => { if (controller.signal.aborted) throw new MirrorCancelled() })
    const release = vi.spyOn(fixture, 'releaseStorageSnapshot')
    vi.spyOn(fixture, 'prepareStorageSnapshots').mockResolvedValue({ stagingRoot: 'snapshot-root', files: new Map(), excluded: [] } as never)
    const held = deferred<void>(), inFlight = deferred<void>()
    const originalCopy = filesystem.copyFile
    const names = ['a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt', 'f.txt']
    try {
      await filesystem.mkdir(source); await filesystem.mkdir(destination); await filesystem.mkdir(join(trash, '2001-01-01_00-00-00'), { recursive: true })
      for (const name of names) await filesystem.writeFile(join(source, name), name)
      await filesystem.writeFile(join(destination, 'gone.txt'), 'recoverable')
      const copied: string[] = []
      vi.spyOn(filesystem, 'copyFile').mockImplementation(async (...args) => {
        copied.push(String(args[1])); if (copied.length === 4) inFlight.resolve(); await held.promise; await originalCopy(...args)
      })
      const service = createMirrorService(fixture)
      const pending = service.runMirror({ ...plan(), trashPath: trash, retention: { keepDays: 0, dailies: 0, weeklies: 0 }, mappings: [{ source, destination, exclude: [] }] }, () => {})
      await inFlight.promise
      controller.abort()
      held.resolve()
      expect(await pending).toMatchObject({ ok: false, cancelled: true, archived: 1, copied: 4 })
      expect(copied).toHaveLength(4)
      for (const target of copied) expect(await filesystem.readFile(target, 'utf8')).toBe(target.split('/').at(-1))
      const untouched = names.filter((name) => !copied.includes(join(destination, name)))
      expect(untouched).toHaveLength(2)
      for (const name of untouched) await expect(filesystem.access(join(destination, name))).rejects.toThrow()
      expect(await filesystem.readdir(trash)).toContain('2001-01-01_00-00-00')
      const archived = (await filesystem.readdir(trash)).find((name) => name !== '2001-01-01_00-00-00')!
      expect(await filesystem.readFile(join(trash, archived, 'source', 'gone.txt'), 'utf8')).toBe('recoverable')
      expect(release).toHaveBeenCalledOnce()
      expect(release).toHaveBeenCalledWith('snapshot-root')
    } finally { await filesystem.rm(root, { recursive: true, force: true }) }
  })

  it('leaves the source intact when cancellation follows a cross-volume escrow copy', async () => {
    const root = await filesystem.mkdtemp(join(tmpdir(), 'backup-escrow-cancel-'))
    const source = join(root, 'source'), destination = join(root, 'destination'), escrow = join(root, 'escrow')
    const controller = new AbortController()
    const fixture = mirrorFixture(() => { if (controller.signal.aborted) throw new MirrorCancelled() })
    const cp = filesystem.cp
    try {
      await filesystem.mkdir(source); await filesystem.mkdir(destination)
      await filesystem.writeFile(join(destination, 'gone.txt'), 'recoverable')
      vi.spyOn(filesystem, 'rename').mockRejectedValue(Object.assign(new Error('Other device'), { code: 'EXDEV' }))
      vi.spyOn(filesystem, 'cp').mockImplementation(async (...args) => { await cp(...args); controller.abort() })
      expect(await createMirrorEngine(fixture.fs)({ source, destination, exclude: [], backupDir: escrow })).toMatchObject({ ok: false, cancelled: true, archived: 0 })
      expect(await filesystem.readFile(join(destination, 'gone.txt'), 'utf8')).toBe('recoverable')
      expect(await filesystem.readFile(join(escrow, 'gone.txt'), 'utf8')).toBe('recoverable')
    } finally { await filesystem.rm(root, { recursive: true, force: true }) }
  })
})

describe('backup frontend operation lifetime', () => {
  async function commandFixture(commandId: 'check' | 'run') {
    const { registerBackupCommands } = await import('../src/commands')
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'fixture', name: 'Fixture', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const registrations = vi.spyOn(api.commands, 'register')
    const off = registerBackupCommands(api, store, operations)
    const command = registrations.mock.calls.find(([entry]) => entry.id === commandId)![0]
    return { api, store, operations, off, command }
  }

  it.each(['check', 'run', 'prune', 'restorePlan', 'restoreApply'] as const)('passes cancellation to %s and joins its accepted result without resubmitting', async (method) => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    const held = deferred<unknown>()
    api.backend.callOperation = vi.fn(() => held.promise) as typeof api.backend.callOperation
    const legacy = vi.spyOn(api.backend, 'call')
    const client = backupApi(api)
    const controller = new AbortController()
    const pending = method === 'prune' ? client.prune(plan(), { dryRun: true }, controller.signal)
      : method === 'restorePlan' || method === 'restoreApply' ? client[method](plan(), 0, controller.signal)
        : client[method](plan(), controller.signal)
    let settled = false
    void pending.finally(() => { settled = true })
    expect(api.backend.callOperation).toHaveBeenCalledWith(method, expect.objectContaining({ plan: plan() }), { cancellation: controller.signal })
    controller.abort()
    await turns()
    expect(settled).toBe(false)
    expect(vi.mocked(api.backend.callOperation).mock.calls[0][2]?.cancellation?.aborted).toBe(true)
    held.resolve(completed)
    expect(await pending).toEqual({ ok: true, data: completed })
    expect(api.backend.callOperation).toHaveBeenCalledTimes(1)
    expect(legacy).not.toHaveBeenCalled()
  })

  it.each(['run', 'prune', 'restoreApply'] as const)('returns an uncertain %s failure once without replaying the mutation', async (method) => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    const held = deferred<unknown>()
    api.backend.callOperation = vi.fn(() => held.promise) as typeof api.backend.callOperation
    const legacy = vi.spyOn(api.backend, 'call')
    const client = backupApi(api)
    const pending = method === 'restoreApply' ? client.restoreApply(plan(), 0) : client[method](plan())
    held.reject(new Error('Connection ended after dispatch; completion is unknown'))
    expect(await pending).toEqual({ ok: false, error: 'Connection ended after dispatch; completion is unknown' })
    await turns()
    expect(api.backend.callOperation).toHaveBeenCalledTimes(1)
    expect(legacy).not.toHaveBeenCalled()
  })

  it.each(['check', 'run', 'prune', 'restorePlan', 'restoreApply'] as const)('copies the accepted %s plan while its operation is pending', async (method) => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    const held = deferred<unknown>()
    api.backend.callOperation = vi.fn(() => held.promise) as typeof api.backend.callOperation
    const accepted = { ...plan(), retention: { keepDays: 7, dailies: 30, weeklies: 8 } }
    accepted.mappings[0].exclude.push('original')
    const client = backupApi(api)
    const pending = method === 'restorePlan' || method === 'restoreApply' ? client[method](accepted, 0) : client[method](accepted)
    accepted.mappings[0].destination = '/changed'; accepted.mappings[0].exclude[0] = 'changed'
    accepted.retention.keepDays = 1
    held.resolve(completed)
    await pending
    const payload = vi.mocked(api.backend.callOperation).mock.calls[0][1]
    expect(payload).toMatchObject({ plan: { mappings: [{ destination: '/fixtures/destination', exclude: ['original'] }], retention: { keepDays: 7 } } })
  })

  it('waits for the backend history claim before mutation and drains cancellation', async () => {
    const owned = backend()
    const held = deferred<void>(), entered = deferred<void>()
    const original = owned.api.data.files.writeTextGuarded
    vi.spyOn(owned.api.data.files, 'writeTextGuarded').mockImplementationOnce(async (...args) => {
      const result = await original(...args)
      entered.resolve(); await held.promise
      return result
    })
    const controller = new AbortController()
    const task = owned.invoke('run', { plan: plan(), identity: runIdentity() }, owned.context(controller))
    const outcome = task.catch(error => error)
    await entered.promise
    expect(owned.storage.copy).not.toHaveBeenCalled()
    const disposal = owned.dispose()
    held.resolve()
    await outcome
    await disposal
    expect(owned.storage.copy).not.toHaveBeenCalled()
  })

  it('records the backend run before work and preserves its completed claim against replay', async () => {
    const owned = backend()
    const held = deferred<Awaited<ReturnType<PluginStorageApi['list']>>>(), entered = deferred<void>()
    vi.mocked(owned.storage.list).mockImplementationOnce(() => { entered.resolve(); return held.promise })
    const identity = { ...runIdentity(), id: 'scheduled:fixture:1', trigger: 'scheduled' }
    const runs = createHistoryStore(owned.api)
    const task = owned.invoke('run', { plan: plan(), identity })
    await entered.promise
    expect((await runs.query()).rows[0]).toMatchObject({ id: identity.id, ok: false, reason: 'interrupted' })
    held.resolve([])
    expect(await task).toMatchObject({ ok: true })
    expect((await runs.query()).rows[0]).toMatchObject({ ok: true, reason: null })
    await expect(owned.invoke('run', { plan: plan(), identity })).rejects.toThrow('already started')
    expect((await runs.query()).rows[0]).toMatchObject({ ok: true, reason: null })
    await owned.dispose()
  })

  it('passes explicit Stop to the accepted background operation once', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'fixture', name: 'Fixture', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const entered = deferred<void>()
    api.backend.callOperation = vi.fn(async (method: string, _payload?: unknown, options?: { cancellation?: AbortSignal }) => {
      if (method !== 'run') return undefined
      entered.resolve()
      await new Promise(resolve => options?.cancellation?.addEventListener('abort', resolve))
      return { ...completed, ok: false, cancelled: true, archived: 1, copied: 2 }
    }) as typeof api.backend.callOperation
    const notify = vi.spyOn(api.notifications, 'notify')
    const task = operations.run(undefined, true)
    await entered.promise
    expect(operations.cancel()).toBe(true)
    expect(operations.cancel()).toBe(false)
    expect(await task).toMatchObject({ ok: true, data: { cancelled: true, copied: 2 } })
    expect(notify).not.toHaveBeenCalled()
    await operations.dispose()
    store.dispose()
  })

  it('aborts every pending standalone check and joins their accepted results independently', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'fixture', name: 'Fixture', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const first = deferred<unknown>(), second = deferred<unknown>(), third = deferred<unknown>()
    api.backend.callOperation = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise) as typeof api.backend.callOperation
    const notify = vi.spyOn(api.notifications, 'notify')
    const firstCheck = operations.check(), secondCheck = operations.check(), thirdCheck = operations.check()
    const signals = vi.mocked(api.backend.callOperation).mock.calls.map((call) => call[2]?.cancellation)
    expect(new Set(signals).size).toBe(3)
    expect(signals.every((signal) => signal?.aborted === false)).toBe(true)
    first.resolve({ ok: true, issues: [] })
    expect(await firstCheck).toEqual({ ok: true, data: { ok: true, issues: [] } })
    let drained = false
    const disposal = operations.dispose()
    expect(operations.dispose()).toBe(disposal)
    void disposal.then(() => { drained = true })
    expect(signals.map((signal) => signal?.aborted)).toEqual([false, true, true])
    expect(() => operations.check()).toThrow('no longer active')
    second.resolve({ ok: true, issues: [] })
    expect(await secondCheck).toEqual({ ok: true, data: { ok: true, issues: [] } })
    await turns()
    expect(drained).toBe(false)
    third.reject(new Error('Backup operation cancelled'))
    expect(await thirdCheck).toEqual({ ok: false, error: 'Backup operation cancelled' })
    await disposal
    expect(api.backend.callOperation).toHaveBeenCalledTimes(3)
    expect(notify).not.toHaveBeenCalled()
    store.dispose()
  })

  it('stops after a delayed precheck on disposal without dispatching or notifying', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'fixture', name: 'Fixture', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const held = deferred<unknown>()
    api.backend.callOperation = vi.fn(() => held.promise) as typeof api.backend.callOperation
    const notify = vi.spyOn(api.notifications, 'notify')
    const running = operations.run()
    const rejected = expect(running).rejects.toThrow('no longer active')
    let settled = false
    const drained = operations.dispose().then(() => { settled = true })
    expect(vi.mocked(api.backend.callOperation).mock.calls[0][2]?.cancellation?.aborted).toBe(false)
    await turns(); expect(settled).toBe(false)
    held.resolve({ ok: true, issues: [] })
    await rejected; await drained
    expect(vi.mocked(api.backend.callOperation).mock.calls.map(([method]) => method)).toEqual(['check'])
    expect(notify).not.toHaveBeenCalled()
    store.dispose()
  })

  it.each(['check', 'run'] as const)('retains the %s command scope and cancellation listener until its accepted work drains', async (commandId) => {
    const { api, store, operations, off, command } = await commandFixture(commandId)
    const held = deferred<unknown>(), entered = deferred<void>()
    const scopedCall = vi.fn(async (method: string) => {
      if (method === commandId) { entered.resolve(); return held.promise }
      return { ok: true, issues: [] }
    }) as typeof api.backend.callOperation
    const originalCall = vi.spyOn(api.backend, 'callOperation')
    const forOperation = vi.spyOn(api, 'forOperation').mockReturnValue({ ...api, backend: { ...api.backend, callOperation: scopedCall } })
    const notify = vi.spyOn(api.notifications, 'notify')
    const caller = new AbortController()
    const added = vi.spyOn(caller.signal, 'addEventListener'), removed = vi.spyOn(caller.signal, 'removeEventListener')
    const operation = { operationId: `accepted-${commandId}` }
    const pending = Promise.resolve(command.run(command.input!.parse({ profileId: 'fixture' }), { caller: 'plugin', operation, cancellation: caller.signal }))
    await entered.promise
    expect(forOperation).toHaveBeenCalledTimes(1)
    expect(forOperation).toHaveBeenCalledWith(operation)
    const signals = vi.mocked(scopedCall).mock.calls.map((call) => call[2]?.cancellation)
    expect(new Set(signals).size).toBe(1)
    expect(signals[0]).not.toBe(caller.signal)
    expect(signals[0]?.aborted).toBe(false)
    caller.abort()
    expect(signals[0]?.aborted).toBe(true)
    let drained = false
    const disposal = operations.dispose().then(() => { drained = true })
    await turns()
    expect(drained).toBe(false)
    expect(removed).not.toHaveBeenCalled()
    const result = commandId === 'check' ? { ok: true, issues: [] } : completed
    held.resolve(result)
    expect(await pending).toEqual(commandId === 'check' ? result : { value: result, revert: null })
    await disposal
    const listener = added.mock.calls.find(([event]) => event === 'abort')![1]
    expect(removed).toHaveBeenCalledTimes(1)
    expect(removed).toHaveBeenCalledWith('abort', listener)
    expect(vi.mocked(scopedCall).mock.calls.map(([method]) => method)).toEqual(commandId === 'check' ? ['check'] : ['check', 'run'])
    expect(originalCall).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    await off()
    store.dispose()
  })

  it.each(['check', 'run'] as const)('rejects a pre-cancelled %s caller before backend dispatch', async (commandId) => {
    const { api, store, off, command } = await commandFixture(commandId)
    const backend = vi.spyOn(api.backend, 'callOperation')
    const forOperation = vi.spyOn(api, 'forOperation')
    const notify = vi.spyOn(api.notifications, 'notify')
    const caller = new AbortController()
    caller.abort()
    const added = vi.spyOn(caller.signal, 'addEventListener')
    await expect(command.run(command.input!.parse({ profileId: 'fixture' }), { caller: 'plugin', operation: { operationId: 'already-cancelled' }, cancellation: caller.signal })).rejects.toThrow('Backup operation cancelled')
    expect(backend).not.toHaveBeenCalled()
    expect(forOperation).not.toHaveBeenCalled()
    expect(added).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    await off()
    store.dispose()
  })

  it('does not dispatch a run when its caller cancels during a successful precheck', async () => {
    const { api, store, off, command } = await commandFixture('run')
    const held = deferred<unknown>()
    api.backend.callOperation = vi.fn(() => held.promise) as typeof api.backend.callOperation
    const caller = new AbortController()
    const removed = vi.spyOn(caller.signal, 'removeEventListener')
    const notify = vi.spyOn(api.notifications, 'notify')
    const pending = command.run(command.input!.parse({ profileId: 'fixture' }), { caller: 'plugin', cancellation: caller.signal })
    const rejected = expect(pending).rejects.toThrow('Backup operation cancelled')
    caller.abort()
    await turns()
    expect(removed).not.toHaveBeenCalled()
    held.resolve({ ok: true, issues: [] })
    await rejected
    expect(vi.mocked(api.backend.callOperation).mock.calls.map(([method]) => method)).toEqual(['check'])
    expect(removed).toHaveBeenCalledTimes(1)
    expect(notify).not.toHaveBeenCalled()
    await off()
    store.dispose()
  })

  it.each([
    ['prune-preview', 'prune', false], ['prune', 'prune', true],
    ['restore-preview', 'restorePlan', false], ['restore', 'restoreApply', true]
  ] as const)('forwards the existing %s command scope and cancellation without replaying its accepted work', async (commandId, method, write) => {
    const { registerBackupCommands } = await import('../src/commands')
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'fixture', name: 'Fixture', mappings: [{ source: '/fixtures/source', destination: '/fixtures/destination' }] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const registrations = vi.spyOn(api.commands, 'register')
    const held = deferred<unknown>()
    const scopedCall = vi.fn(() => held.promise) as typeof api.backend.callOperation
    const originalCall = vi.spyOn(api.backend, 'callOperation')
    const scopedApi = { ...api, backend: { ...api.backend, callOperation: scopedCall } }
    const forOperation = vi.spyOn(api, 'forOperation').mockReturnValue(scopedApi)
    const off = registerBackupCommands(api, store, operations)
    const command = registrations.mock.calls.find(([entry]) => entry.id === commandId)![0]
    const input = command.input!.parse({ profileId: 'fixture', ...(method.startsWith('restore') ? { mappingIndex: 0 } : {}) })
    const controller = new AbortController()
    const operation = { operationId: 'accepted-maintenance-operation' }
    const pending = Promise.resolve(command.run(input, { caller: 'plugin', operation, cancellation: controller.signal }))
    let settled = false
    void pending.then(() => { settled = true })
    expect(forOperation).toHaveBeenCalledWith(operation)
    expect(scopedCall).toHaveBeenCalledWith(method, expect.objectContaining({ plan: expect.objectContaining({ label: 'Fixture' }) }), { cancellation: controller.signal })
    controller.abort()
    await turns()
    expect(settled).toBe(false)
    const result = method === 'prune' ? { dropped: [], kept: 0, errors: [] } : { ok: true, creates: [], updates: [], deletes: [] }
    held.resolve(result)
    expect(await pending).toEqual(write ? { value: result, revert: null } : result)
    expect(scopedCall).toHaveBeenCalledTimes(1)
    expect(originalCall).not.toHaveBeenCalled()
    await off()
    store.dispose()
  })

  it('joins a completed originating run without starting late history writes or notifications', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'fixture', name: 'Fixture', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const held = deferred<unknown>(), entered = deferred<void>()
    api.backend.callOperation = vi.fn(async (method: string) => {
      if (method === 'run') { entered.resolve(); return held.promise }
      return undefined
    }) as typeof api.backend.callOperation
    const writes = vi.spyOn(api.data.files, 'writeTextGuarded'), notify = vi.spyOn(api.notifications, 'notify')
    const pending = operations.run(undefined, true)
    await entered.promise
    expect(writes).not.toHaveBeenCalled()
    const drained = operations.dispose()
    expect(vi.mocked(api.backend.callOperation).mock.calls[0][2]?.cancellation?.aborted).toBe(false)
    held.resolve(completed)
    expect(await pending).toEqual({ ok: true, data: completed })
    await drained
    expect(vi.mocked(api.backend.callOperation).mock.calls.map(([method]) => method)).toEqual(['run'])
    expect(writes).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    store.dispose()
  })
})
