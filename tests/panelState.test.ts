import { afterEach, expect, it, vi } from 'vitest'
import { createMockValleyApi } from '@valley/plugin-testkit'
import { createHistoryStore, HISTORY_FILE } from '../src/history'
type HistoryPage = Awaited<ReturnType<ReturnType<typeof createHistoryStore>['query']>>
import { createBackupPanelState } from '../src/panelState'
import { parseProfiles } from '../src/profiles'

const disposers: Array<() => Promise<void>> = []
afterEach(async () => { await Promise.all(disposers.splice(0).map(dispose => dispose())); vi.restoreAllMocks() })

function fixture() {
  const mock = createMockValleyApi({ manifest: { id: 'backup' } })
  const history = createHistoryStore(mock.api)
  let changed = (_path: string): void => {}
  vi.spyOn(mock.api.data.files, 'onChanged').mockImplementation(listener => { changed = listener; return () => {} })
  const insert = async (row: Parameters<typeof history.insert>[0]) => { await history.insert(row); changed(HISTORY_FILE) }
  const profile = parseProfiles({ profiles: [{ id: 'field', name: 'Field', mappings: [] }] })[0]
  const ports = {
    isActive: vi.fn(() => true),
    profile: vi.fn(() => profile),
    missingFolders: vi.fn(async () => [] as string[]),
    check: vi.fn(async () => ({ ok: true as const, data: { ok: true, issues: [] } })),
    run: vi.fn(async () => ({ ok: true as const, data: { ok: true, mappings: 1, archived: 2, durationSec: 3, errors: 0 } })),
    history: vi.fn((limit = 50) => history.query(limit)),
    stop: vi.fn(async () => true)
  }
  const state = createBackupPanelState(mock.api, ports)
  disposers.push(state.dispose)
  return { ...mock, ports, state, insert }
}

it('shares panel history and reruns a pending snapshot once after a history file change', async () => {
  const f = fixture()
  let release!: (page: HistoryPage) => void
  const held = new Promise<HistoryPage>(resolve => { release = resolve })
  f.ports.history.mockReturnValueOnce(held)
  const first = vi.fn(), second = vi.fn()
  const off = f.state.subscribe(first)
  const offSecond = f.state.subscribe(second)
  expect(f.ports.history).toHaveBeenCalledOnce()
  await f.insert({ id: 'new', startedAt: '2026-09-19', profileName: 'Field', ok: true })
  release({ rows: [{ id: 'old', startedAt: '2026-09-18' }], revision: 1 })
  await vi.waitFor(() => expect(f.state.getSnapshot().history.map(item => item.id)).toEqual(['new']))
  expect(f.ports.history).toHaveBeenCalledTimes(2)
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
  off(); offSecond()
})

it('contains a failed history read and recovers on retry without discarding retained history', async () => {
  const f = fixture()
  await f.insert({ id: 'kept', startedAt: '2026-09-19', profileName: 'Field' })
  await f.state.loadHistory()
  f.ports.history.mockRejectedValueOnce(new Error('Unavailable'))
  await f.state.loadHistory()
  expect(f.state.getSnapshot().history[0].id).toBe('kept')
  expect(f.state.getSnapshot().historyError).toBeTruthy()
  await f.state.loadHistory()
  expect(f.state.getSnapshot().historyError).toBeNull()
})

it('joins accepted history on disposal without publishing after teardown', async () => {
  const f = fixture()
  let release!: (page: HistoryPage) => void
  f.ports.history.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
  const listener = vi.fn()
  f.state.subscribe(listener)
  const settled = vi.fn()
  const disposal = f.state.dispose().then(settled)
  await Promise.resolve()
  expect(settled).not.toHaveBeenCalled()
  release({ rows: [{ id: 'late', startedAt: '2026-09-19' }], revision: 1 })
  await disposal
  expect(listener).not.toHaveBeenCalled()
  expect(f.state.getSnapshot().history).toEqual([])
})

it('deduplicates preflight and retains a run across panel remounts', async () => {
  const f = fixture()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  f.ports.check.mockImplementationOnce(async () => { await held; return { ok: true, data: { ok: true, issues: [] } } })
  const off = f.state.subscribe(vi.fn())
  const first = f.state.start('field')
  expect(f.state.start('field')).toBe(first)
  off()
  const next = vi.fn()
  f.state.subscribe(next)
  release()
  await first
  expect(f.ports.check).toHaveBeenCalledOnce()
  expect(f.ports.run).toHaveBeenCalledOnce()
  expect(f.state.getSnapshot()).toMatchObject({ status: 'done', startedAt: expect.any(Number) })
  expect(next).toHaveBeenCalled()
})

it('appends batched log lines and reports a stopped run without failing it', async () => {
  const f = fixture()
  let finish!: (value: unknown) => void
  f.ports.run.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve as (value: unknown) => void }) as never)
  const progress = vi.mocked(f.api.backend.on).mock.calls.find(([event]) => event === 'progress')![1]
  const off = f.state.subscribe(vi.fn())
  const task = f.state.start('field')
  await vi.waitFor(() => expect(f.state.getSnapshot().status).toBe('running'))
  progress({ lines: ['▸ Syncing: field', '  a.md'] })
  progress({ lines: ['  b.md'] })
  progress({ mapping: { index: 1, folder: 'field', source: '/fixtures/field', destination: '/backups/field', status: 'running' } })
  progress({ update: { folder: 'field', mappingIndex: 1, mappingCount: 1, percent: 40, etaSeconds: 3, phase: 'transferring', files: { done: 2, total: 5 }, bytes: { done: 10, total: 25 } } })
  expect(f.state.getSnapshot().lines).toEqual(['▸ Syncing: field', '  a.md', '  b.md'])
  expect(f.state.getSnapshot().progress?.files).toEqual({ done: 2, total: 5 })
  f.state.stop()
  f.state.stop()
  expect(f.ports.stop).toHaveBeenCalledOnce()
  finish({ ok: true, data: { ok: false, cancelled: true, mappings: 1, archived: 1, copied: 2, durationSec: 1, errors: 0 } })
  await task
  expect(f.state.getSnapshot()).toMatchObject({ status: 'stopped', summary: 'Stopped — 2 copied, 1 archived', progress: null })
  expect(f.state.getSnapshot().mappingResults).toEqual([expect.objectContaining({ folder: 'field', status: 'stopped' })])
  off()
})

it('resumes a stopped run with the folders left and Cancel returns to a fresh start', async () => {
  const f = fixture()
  f.ports.profile.mockReturnValue(parseProfiles({ profiles: [{ id: 'field', name: 'Field', mappings: [{ source: '/fixtures/a', destination: '/backups/a' }, { source: '/fixtures/b', destination: '/backups/b' }] }] })[0])
  const progress = vi.mocked(f.api.backend.on).mock.calls.find(([event]) => event === 'progress')![1]
  const a = { folder: 'a', source: '/fixtures/a', destination: '/backups/a' }, b = { folder: 'b', source: '/fixtures/b', destination: '/backups/b' }
  const stopRun = async (task: Promise<void>, finish: () => (value: unknown) => void): Promise<void> => {
    await vi.waitFor(() => expect(f.state.getSnapshot().status).toBe('running'))
    f.state.stop()
    finish()({ ok: true, data: { ok: false, cancelled: true, mappings: 2, archived: 0, copied: 1, durationSec: 1, errors: 0 } })
    await task
  }
  let finish!: (value: unknown) => void
  const held = () => new Promise((resolve) => { finish = resolve as (value: unknown) => void }) as never
  f.ports.run.mockImplementationOnce(held)
  const off = f.state.subscribe(vi.fn())
  const first = f.state.start('field')
  await vi.waitFor(() => expect(f.ports.run).toHaveBeenCalledOnce())
  progress({ mapping: { index: 1, ...a, status: 'done' } })
  progress({ mapping: { index: 2, ...b, status: 'running' } })
  await stopRun(first, () => finish)
  expect(f.state.getSnapshot()).toMatchObject({ status: 'stopped', resumeProfileId: 'field' })

  f.ports.run.mockImplementationOnce(held)
  const resumed = f.state.start('field', { resume: true })
  await vi.waitFor(() => expect(f.ports.run).toHaveBeenCalledTimes(2))
  expect(f.ports.check).toHaveBeenLastCalledWith('field', undefined, [], ['/backups/a'])
  expect(f.ports.run).toHaveBeenLastCalledWith('field', true, undefined, { skipFolders: [], doneDestinations: ['/backups/a'] })
  expect(f.state.getSnapshot().mappingResults).toEqual([expect.objectContaining({ destination: '/backups/a', status: 'done' })])
  progress({ mapping: { index: 1, ...b, status: 'running' } })
  expect(f.state.getSnapshot().mappingResults.map(item => [item.destination, item.status])).toEqual([['/backups/a', 'done'], ['/backups/b', 'running']])
  await stopRun(resumed, () => finish)

  f.state.discardStopped()
  expect(f.state.getSnapshot()).toMatchObject({ status: 'idle', summary: '', mappingResults: [], resumeProfileId: null })
  await f.state.start('field')
  expect(f.ports.run).toHaveBeenLastCalledWith('field', true, undefined, { skipFolders: [], doneDestinations: [] })
  off()
})

it('stays resumable when a resumed run finds its drive gone', async () => {
  const f = fixture()
  f.ports.run.mockResolvedValueOnce({ ok: true, data: { ok: false, cancelled: true, mappings: 1, archived: 0, durationSec: 1, errors: 0 } } as never)
  const off = f.state.subscribe(vi.fn())
  await f.state.start('field')
  f.ports.check.mockResolvedValueOnce({ ok: true, data: { ok: false, issues: [{ kind: 'drive-not-mounted', message: 'Plug in the drive' }] } } as never)
  await f.state.start('field', { resume: true })
  expect(f.state.getSnapshot()).toMatchObject({ status: 'stopped', resumeProfileId: 'field', issues: [{ message: 'Plug in the drive' }] })
  off()
})

it('passes a scheduled trigger through and stays idle when another window claimed the slot', async () => {
  const f = fixture()
  const { BackupClaimed } = await import('../src/commands')
  f.ports.run.mockRejectedValueOnce(new BackupClaimed())
  const off = f.state.subscribe(vi.fn())
  await f.state.start('field', { trigger: 'scheduled', runId: 'scheduled:field:1' })
  expect(f.ports.run).toHaveBeenCalledWith('field', true, undefined, { trigger: 'scheduled', runId: 'scheduled:field:1' })
  expect(f.state.getSnapshot()).toMatchObject({ status: 'idle', progress: null })
  off()
})
