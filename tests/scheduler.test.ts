import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockValleyApi } from '@valley/plugin-testkit'
import type { PluginBackendApi } from '@valley/plugin-sdk'
import { register } from '../src/backend/index'
import { createBackupScheduler } from '../src/scheduler'
import { createHistoryStore, type RunRecord } from '../src/history'
import { parseProfiles } from '../src/profiles'
import { slotStart } from '../src/schedule'

const NOW = new Date(2026, 8, 24, 9).getTime()
const profiles = [{ id: 'field', name: 'Field archive', mappings: [{ source: '/fixtures/source', destination: '/fixtures/destination' }], schedule: { every: 'daily', time: '02:00', since: new Date(2026, 0, 1).getTime() } }]

async function fixture(rows: RunRecord[] = [], saved = profiles) {
  const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: saved } })
  const history = createHistoryStore(api)
  for (const row of rows) await history.insert(row)
  const handlers = new Map<string, (payload?: unknown) => unknown>()
  const listeners = new Map<string, (payload: unknown) => void>()
  const check = vi.fn(async () => ({ ok: true, issues: [] as { kind: string; message: string }[] }))
  const run = vi.fn(async (value: unknown) => {
    const { identity } = value as { identity: RunRecord }
    await history.insert({ ...identity, ok: true, reason: null })
    return { ok: true }
  })
  const notify = vi.spyOn(api.notifications, 'notify').mockResolvedValue(true)
  const backend = { ...api, i18n: { t: api.ui.t, language: () => 'en', onLanguageChanged: () => () => {} }, lifecycle: { onResume: () => () => {}, runBackground: (method: string, value: unknown) => method === 'check' ? check() : run(value) },
    rpc: { emit: (event: string, value: unknown) => listeners.get(event)?.(structuredClone(value)), handle: (name: string, handler: (payload?: unknown) => unknown) => { handlers.set(name, handler); return () => handlers.delete(name) }, handleOperation: () => () => {} }
  } as unknown as PluginBackendApi
  api.backend.call = async <T>(method: string) => await handlers.get(method)!() as T
  api.backend.on = (event, callback) => { listeners.set(event, callback); return () => { listeners.delete(event) } }
  const off = register(backend)
  const client = createBackupScheduler(api, {} as never)
  return { api, client, check, run, notify, off }
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('background backup scheduling', () => {
  it('keeps no minute timer while no profile has a schedule, and arms one when a schedule appears', async () => {
    const interval = vi.spyOn(globalThis, 'setInterval')
    const f = await fixture([], [{ id: 'field', name: 'Field archive', mappings: [{ source: '/fixtures/source', destination: '/fixtures/destination' }] }] as never)
    await vi.advanceTimersByTimeAsync(0)
    expect(interval).not.toHaveBeenCalledWith(expect.anything(), 60000)
    await f.api.settings.set('profiles', profiles)
    await vi.advanceTimersByTimeAsync(0)
    expect(interval).toHaveBeenCalledWith(expect.anything(), 60000)
    await f.client.dispose(); await f.off()
  })

  it('claims a due slot in the backend and exposes its next run to the UI', async () => {
    const f = await fixture()
    await vi.advanceTimersByTimeAsync(0)
    const slot = slotStart(parseProfiles({ profiles })[0].schedule!, NOW)
    expect(f.run).toHaveBeenCalledWith(expect.objectContaining({ identity: expect.objectContaining({ id: `scheduled:field:${slot}`, trigger: 'scheduled' }) }))
    expect(f.client.getSnapshot().field.nextAt).toBe(new Date(2026, 8, 25, 2).getTime())
    await vi.advanceTimersByTimeAsync(180_000)
    expect(f.run).toHaveBeenCalledOnce()
    await f.client.dispose(); await f.off()
  })

  it('does not repeat a slot already completed before startup', async () => {
    const f = await fixture([{ id: 'previous', profileId: 'field', startedAt: new Date(2026, 8, 24, 8).toISOString(), ok: true, trigger: 'manual' }])
    await vi.advanceTimersByTimeAsync(120_000)
    expect(f.check).not.toHaveBeenCalled()
    expect(f.run).not.toHaveBeenCalled()
    expect(f.client.getSnapshot().field.nextAt).toBe(new Date(2026, 8, 25, 2).getTime())
    await f.client.dispose(); await f.off()
  })

  it('uses one durable source identity while a drive is missing and starts when it returns', async () => {
    const f = await fixture()
    f.check.mockResolvedValue({ ok: false, issues: [{ kind: 'drive-not-mounted', message: 'Fixture drive unavailable' }] })
    await vi.advanceTimersByTimeAsync(180_000)
    expect(f.notify.mock.calls.every(([event]) => event === 'waiting')).toBe(true)
    expect(new Set(f.notify.mock.calls.map(([, value]) => value.sourceEventId)).size).toBe(1)
    expect(f.run).not.toHaveBeenCalled()
    expect(f.client.getSnapshot().field.waiting).toBe('Fixture drive unavailable')
    f.check.mockResolvedValue({ ok: true, issues: [] })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(f.run).toHaveBeenCalledOnce()
    expect(f.client.getSnapshot().field.waiting).toBeNull()
    await f.client.dispose(); await f.off()
  })

  it('continues polling after the UI closes', async () => {
    const f = await fixture()
    f.check.mockResolvedValue({ ok: false, issues: [{ kind: 'drive-not-mounted', message: 'Fixture drive unavailable' }] })
    await vi.advanceTimersByTimeAsync(0)
    await f.client.dispose()
    f.check.mockResolvedValue({ ok: true, issues: [] })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(f.run).toHaveBeenCalledOnce()
    await f.off()
  })

  it('ignores incomplete and unscheduled profiles', async () => {
    const f = await fixture([], [{ ...profiles[0], mappings: [] }])
    await vi.advanceTimersByTimeAsync(120_000)
    expect(f.check).not.toHaveBeenCalled()
    expect(f.client.getSnapshot()).toEqual({})
    await f.client.dispose(); await f.off()
  })

  it('stops polling when the backend is disposed', async () => {
    const f = await fixture()
    await f.client.dispose(); await f.off()
    const calls = f.check.mock.calls.length
    await vi.advanceTimersByTimeAsync(180_000)
    expect(f.check).toHaveBeenCalledTimes(calls)
    expect(vi.getTimerCount()).toBe(0)
  })
})
