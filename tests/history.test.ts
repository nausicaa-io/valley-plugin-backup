import { expect, it, vi } from 'vitest'
import { createMockValleyApi } from '@valley/plugin-testkit'
import { BackupClaimed, createHistoryStore, HISTORY_FILE } from '../src/history'
import { register } from '../src/backend/index'
import type { PluginBackendApi, PluginBackendOperationContext } from '@valley/plugin-sdk'

const row = (id: string, startedAt = '2026-09-29T08:00:00Z') => ({ id, startedAt, profileName: 'Field', ok: false, reason: 'interrupted' })

it('persists JSONL across store reloads, updates outcomes, paginates and prunes', async () => {
  const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
  const store = createHistoryStore(api)
  await store.insert(row('old', '2026-09-28T08:00:00Z'))
  await store.insert(row('new'))
  await store.update('new', { ok: true, reason: null, copied: 3 })
  const loaded = createHistoryStore(api)
  const first = await loaded.query(1)
  expect(first.rows).toEqual([expect.objectContaining({ id: 'new', ok: true, copied: 3 })])
  expect((await loaded.query(1, first.nextCursor)).rows[0].id).toBe('old')
  await loaded.prune(1)
  const text = await api.data.files.readText(HISTORY_FILE)
  expect(text?.trim().split('\n').map(line => JSON.parse(line))).toEqual(first.rows)
})

it('retains concurrent inserts and allows only one claimant for a scheduled slot', async () => {
  const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
  const first = createHistoryStore(api), second = createHistoryStore(api)
  await Promise.all([first.insert(row('a')), second.insert(row('b'))])
  expect((await first.query()).rows).toHaveLength(2)
  const claims = await Promise.allSettled([first.insert(row('scheduled:field:1')), second.insert(row('scheduled:field:1'))])
  expect(claims.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(claims.find(result => result.status === 'rejected')).toMatchObject({ reason: expect.any(BackupClaimed) })
})

it('preserves malformed files and propagates write failures', async () => {
  const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
  await api.data.files.writeTextGuarded(HISTORY_FILE, '{broken', null)
  const store = createHistoryStore(api)
  await expect(store.insert(row('a'))).rejects.toThrow()
  expect(await api.data.files.readText(HISTORY_FILE)).toBe('{broken')
  vi.spyOn(api.data.files, 'readTextBaseline').mockResolvedValue(null)
  vi.spyOn(api.data.files, 'writeTextGuarded').mockResolvedValue({ ok: false, reason: 'error' })
  await expect(store.insert(row('a'))).rejects.toThrow('Could not save backup history')
})

it('does not mutate a destination when the backend history claim cannot be saved', async () => {
  const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
  const operations = new Map<string, (value: unknown, context: PluginBackendOperationContext) => Promise<unknown>>()
  const storage = { open: vi.fn(), close: vi.fn(), copy: vi.fn() }
  const backend = { pluginId: 'backup', data: api.data, settings: api.settings, notifications: api.notifications,
    lifecycle: { onResume: () => () => {} }, i18n: { t: api.ui.t, language: () => 'en', onLanguageChanged: () => () => {} },
    storage, rpc: { emit: vi.fn(), handle: () => () => {}, handleOperation: (name: string, handler: typeof operations extends Map<string, infer H> ? H : never) => { operations.set(name, handler); return () => {} } }
  } as unknown as PluginBackendApi
  const off = register(backend)
  vi.spyOn(api.data.files, 'writeTextGuarded').mockResolvedValue({ ok: false, reason: 'error' })
  await expect(operations.get('run')!({ plan: { label: 'Field', mappings: [], trashPath: '', logDirectory: '', masterLog: '', retention: null }, identity: { id: 'scheduled:field:1', startedAt: new Date().toISOString(), profileId: 'field', profileName: 'Field', trigger: 'scheduled' } }, { id: 'operation', cancellation: new AbortController().signal, api: backend })).rejects.toThrow('Could not save backup history')
  expect(storage.copy).not.toHaveBeenCalled()
  await off()
})
