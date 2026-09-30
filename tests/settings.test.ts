import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { createMockValleyApi } from '@valley/plugin-testkit'
import { register } from '../src/index'
import { initLocalization, uiText } from '../src/localization'
import { createProfileStore, mirrorPlan, parseProfiles, serializeProfile } from '../src/profiles'
import { createBackupOperations, registerBackupCommands } from '../src/commands'

afterEach(cleanup)

describe('Backup Settings', () => {
  it('shows profiles as overview rows and opens every setting in a detail page', () => {
    const { api } = createMockValleyApi({
      manifest: { id: 'backup' },
      settings: {
        profiles: [
          {
            id: 'field-archive',
            name: 'Field archive',
            mappings: [
              { source: '/fixtures/ferns', destination: '/backups/ferns', exclude: [] },
              { source: '/fixtures/mosses', destination: '/backups/mosses', exclude: ['cache/'] }
            ],
            trashPath: '/backups/trash',
            logDirectory: '/backups/logs',
            masterLog: '/backups/history.log'
          }
        ]
      }
    })
    const dispose = register(api)
    const call = (api.registerView as unknown as {
      mock: { calls: [string, ComponentType][] }
    }).mock.calls.find(([id]) => id === 'backup.settings')
    const SettingsView = call![1]

    render(React.createElement(SettingsView))
    const profile = screen.getByRole('button', { name: /Field archive/ })
    expect(profile).toHaveTextContent('2 Folders')
    expect(profile.querySelector('.backup-settings-badge')).toHaveClass('is-configured')

    fireEvent.click(profile)
    expect(screen.getByRole('textbox', { name: 'Source 1' })).toHaveValue('/fixtures/ferns')
    expect(screen.getByRole('textbox', { name: 'Destination 2' })).toHaveValue('/backups/mosses')
    expect(screen.getByRole('textbox', { name: 'Archive folder' })).toHaveValue('/backups/trash')
    expect(screen.getByRole('textbox', { name: 'Master log file' })).toHaveValue('/backups/history.log')

    fireEvent.click(screen.getByRole('button', { name: 'Backup settings' }))
    expect(screen.getByRole('button', { name: /Field archive/ })).toBeInTheDocument()
    dispose()
  })

  it('uses the host kit and persists an accessible profile mapping', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    const dispose = register(api)
    const call = (api.registerView as unknown as {
      mock: { calls: [string, ComponentType][] }
    }).mock.calls.find(([id]) => id === 'backup.settings')
    expect(call).toBeDefined()
    const SettingsView = call![1]

    render(React.createElement(SettingsView))
    fireEvent.click(screen.getByRole('button', { name: '+ Add profile' }))

    const source = screen.getByRole('textbox', { name: 'Source 1' })
    const destination = screen.getByRole('textbox', { name: 'Destination 1' })
    fireEvent.change(source, { target: { value: '/tmp/source' } })
    fireEvent.blur(source)
    fireEvent.change(destination, { target: { value: '/tmp/destination' } })
    fireEvent.blur(destination)

    await waitFor(() => {
      expect(api.settings.get().profiles).toEqual([
        expect.objectContaining({
          name: 'Profile 1',
          mappings: [
            expect.objectContaining({
              source: '/tmp/source',
              destination: '/tmp/destination'
            })
          ]
        })
      ])
    })
    dispose()
  })

  it('keeps the first pair visible for an empty saved profile and adds pairs below it', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: {
      profiles: [{ id: 'empty', name: 'Empty archive', mappings: [] }]
    } })
    api.ui.confirm = vi.fn(async () => 'remove')
    const dispose = register(api)
    const SettingsView = (api.registerView as unknown as {
      mock: { calls: [string, ComponentType][] }
    }).mock.calls.find(([id]) => id === 'backup.settings')![1]
    render(React.createElement(SettingsView))
    fireEvent.click(screen.getByRole('button', { name: /Empty archive/ }))
    const source = screen.getByRole('textbox', { name: 'Source 1' })
    expect(source).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Remove 1' })).not.toBeInTheDocument()
    for (const name of ['Archive folder', 'Log folder']) {
      const field = screen.getByRole('textbox', { name })
      expect(field.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    const add = screen.getByRole('button', { name: '+ Add folder pair 1' })
    expect(source.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.change(source, { target: { value: '/fixtures/ferns' } })
    fireEvent.blur(source)
    await waitFor(() => expect((api.settings.get().profiles as Array<{ mappings: unknown[] }>)[0].mappings).toEqual([
      expect.objectContaining({ source: '/fixtures/ferns', destination: '' })
    ]))
    fireEvent.click(add)
    expect(screen.getByRole('textbox', { name: 'Source 2' })).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Remove 1' }))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Source 2' })).not.toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Source 1' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Remove 1' })).not.toBeInTheDocument()
    await dispose()
  })

  it('saves pair names and multiple folder paths and patterns in the single exclusion field', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: {
      profiles: [{ id: 'forest', name: 'Forest', mappings: [{ source: '/fixtures/forest', destination: '/backups/forest', exclude: ['*.tmp'] }] }]
    } })
    const dispose = register(api)
    const SettingsView = (api.registerView as unknown as {
      mock: { calls: [string, ComponentType][] }
    }).mock.calls.find(([id]) => id === 'backup.settings')![1]
    render(React.createElement(SettingsView))
    fireEvent.click(screen.getByRole('button', { name: /Forest/ }))
    const name = screen.getByRole('textbox', { name: 'Folder pair name 1' })
    fireEvent.change(name, { target: { value: 'Forest observations' } })
    fireEvent.blur(name)
    const rules = screen.getByRole('textbox', { name: 'Exclude 1' })
    fireEvent.change(rules, { target: { value: '*.log' } })
    fireEvent.keyDown(rules, { key: 'Enter' })
    expect(screen.queryByRole('button', { name: '+ Add excluded folder' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Exclude folder 1' })).not.toBeInTheDocument()
    for (const value of ['cache, old/', 'drafts/']) {
      fireEvent.change(rules, { target: { value } })
      fireEvent.keyDown(rules, { key: 'Enter' })
    }
    await waitFor(() => expect((api.settings.get().profiles as Array<{ mappings: unknown[] }>)[0].mappings).toEqual([
      { name: 'Forest observations', source: '/fixtures/forest', destination: '/backups/forest', exclude: ['*.tmp', '*.log', 'cache, old/', 'drafts/'] }
    ]))
    cleanup()
    render(React.createElement(SettingsView))
    fireEvent.click(screen.getByRole('button', { name: /Forest/ }))
    expect(screen.getByRole('textbox', { name: 'Folder pair name 1' })).toHaveValue('Forest observations')
    expect(screen.getByText('cache, old/')).toBeInTheDocument()
    expect(screen.getByText('drafts/')).toBeInTheDocument()
    await dispose()
  })

  it('keeps pair display names out of the strict backup plan contract', () => {
    const [profile] = parseProfiles({ profiles: [{ id: 'forest', name: 'Forest', mappings: [
      { name: 'Forest observations', source: '/fixtures/forest', destination: '/backups/forest', exclude: ['cache/', 'drafts/'] }
    ] }] })
    expect(serializeProfile(profile).mappings[0].name).toBe('Forest observations')
    expect(mirrorPlan(profile).mappings).toEqual([
      { source: '/fixtures/forest', destination: '/backups/forest', exclude: ['cache/', 'drafts/'] }
    ])
  })

  it('owns its style node across unregister and re-register', () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    const dispose = register(api)
    expect(document.querySelectorAll('#notes-backup-styles')).toHaveLength(1)
    dispose()
    expect(document.querySelectorAll('#notes-backup-styles')).toHaveLength(0)
    register(api)
    expect(document.querySelectorAll('#notes-backup-styles')).toHaveLength(1)
  })
})

describe('Backup schedule and stop', () => {
  const settingsWith = (extra: Record<string, unknown> = {}) => ({
    activeProfileId: 'field',
    profiles: [{ id: 'field', name: 'Field archive', mappings: [{ source: '/fixtures/ferns', destination: '/backups/ferns' }], ...extra }]
  })
  const viewOf = (api: ReturnType<typeof createMockValleyApi>['api'], id: string) =>
    (api.registerView as unknown as { mock: { calls: [string, ComponentType][] } }).mock.calls.find(([name]) => name === id)![1]

  it('omits scheduling controls and keeps archive cleanup optional', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith() })
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.settings')))
    fireEvent.click(screen.getByRole('button', { name: /Field archive/ }))
    expect(screen.queryByRole('combobox', { name: 'Schedule' })).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Next backup' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Time' })).not.toBeInTheDocument()

    expect(screen.getByRole('switch', { name: 'Clean up old archives' })).toBeChecked()
    fireEvent.click(screen.getByRole('switch', { name: 'Clean up old archives' }))
    await waitFor(() => expect((api.settings.get().profiles as Array<{ retention: string }>)[0].retention).toBe('off'))
    await dispose()
  })

  it('offers Stop while a backup runs and reports the stopped run without a notification', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith() })
    let signal: AbortSignal | undefined
    api.backend.callOperation = vi.fn(async (method: string, _payload?: unknown, options?: { cancellation?: AbortSignal }) => {
      if (method === 'check') return { ok: true, issues: [] }
      signal = options?.cancellation
      await new Promise((resolve) => signal!.addEventListener('abort', resolve))
      return { ok: false, cancelled: true, mappings: 1, archived: 0, copied: 3, durationSec: 1, errors: 0 }
    }) as typeof api.backend.callOperation
    api.notifications.notify = vi.fn(async () => true)
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    fireEvent.click(screen.getByRole('button', { name: 'Backup now' }))
    const stop = await screen.findByRole('button', { name: 'Stop' })
    await act(async () => { fireEvent.click(stop) })
    expect(signal?.aborted).toBe(true)
    expect(await screen.findByText('Stopped — 3 copied, 0 archived')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Backup now' })).toBeEnabled()
    expect(api.notifications.notify).not.toHaveBeenCalled()
    await dispose()
  })

  it('shows when the selected profile backs up next', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith({ schedule: { every: 'daily', time: '02:00', since: Date.now() } }) })
    const next = new Date(); next.setDate(next.getDate() + 1); next.setHours(2, 0, 0, 0)
    api.backend.call = vi.fn(async () => ({ field: { nextAt: next.getTime(), waiting: null } })) as typeof api.backend.call
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    expect(await screen.findByText(/^Next backup (today|tomorrow) 02:00$/)).toBeInTheDocument()
    await dispose()
  })
})

describe('Backup localization', () => {
  it('uses plugin translations first and preserves English interpolation fallbacks', () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    api.ui.t = (key) => key === 'auto.432e860f10ff' ? '备份设置' : key
    initLocalization(api)

    expect(uiText('auto.432e860f10ff')).toBe('备份设置')
    expect(uiText('auto.0943b157227c')).toBe('—  failure(s)')
    expect(uiText('backup.missing')).toBe('backup.missing')
  })
})

describe('Backup automation and shared drafts', () => {
  it('updates the explicit profile, preserves drafts on failed save, and refuses conflicting automation', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'forest', name: 'Forest', mappings: [] }, { id: 'wetlands', name: 'Wetlands', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const off = registerBackupCommands(api, store, operations)
    try {
      expect((await api.commands.execute('backup:profile-update', { profileId: 'wetlands', values: { name: 'Wetland archive' } })).ok).toBe(true)
      expect(store.getSnapshot().map((entry) => entry.name)).toEqual(['Forest', 'Wetland archive'])
      const drafts = store.getSnapshot().map((entry) => entry.id === 'forest' ? { ...entry, name: 'Unsaved forest' } : entry)
      api.settings.set = vi.fn(async () => ({ ok: false, error: 'Disk full' }))
      await expect(store.save(drafts)).rejects.toThrow('Could not save')
      expect(store.getSnapshot()[0].name).toBe('Unsaved forest')
      expect(await api.commands.execute('backup:profile-update', { profileId: 'forest', values: { name: 'Overwrite' } })).toMatchObject({ ok: false, error: { message: expect.stringContaining('Finish editing') } })
      expect(store.getSnapshot()[0].name).toBe('Unsaved forest')
    } finally { off(); store.dispose() }
  })

  it('rejects missing profiles and never starts a backup after a failed precheck', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'forest', name: 'Forest', mappings: [] }] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const off = registerBackupCommands(api, store, operations)
    api.backend.callOperation = vi.fn(async () => { throw new Error('Source is unavailable') })
    try {
      expect(await api.commands.execute('backup:profile-read', { profileId: 'missing' })).toMatchObject({ ok: false, error: { message: expect.stringContaining('not found') } })
      expect(await api.commands.execute('backup:run', { profileId: 'forest' })).toMatchObject({ ok: false, error: { message: 'Source is unavailable' } })
      expect(vi.mocked(api.backend.callOperation).mock.calls.map(([method]) => method)).toEqual(['check'])
    } finally { off(); store.dispose() }
  })
})

describe('Backup owns mirror plans', () => {
  it('preserves disabled retention and filters incomplete mapping drafts only in the execution plan', () => {
    const [profile] = parseProfiles({ profiles: [{ id: 'fern', name: 'Fern archive', retention: 'off', mappings: [
      { source: ' /source ', destination: ' /destination ', exclude: ['*.tmp'] },
      { source: '/unfinished', destination: '' }
    ] }] })
    expect(serializeProfile(profile).retention).toBe('off')
    expect(serializeProfile(profile).mappings).toHaveLength(2)
    expect(mirrorPlan(profile)).toEqual({
      label: 'Fern archive', mappings: [{ source: '/source', destination: '/destination', exclude: ['*.tmp'] }],
      trashPath: '', logDirectory: '', masterLog: '', retention: null
    })
    expect(mirrorPlan(profile, true).retention).toEqual({ keepDays: 7, dailies: 30, weeklies: 8 })
  })

  it('passes one explicit saved plan to its package backend and retains plugin history and notification ownership', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: { activeProfileId: 'fern', profiles: [
      { id: 'fern', name: 'Fern archive', mappings: [{ source: '/source', destination: '/destination' }] }
    ] } })
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    api.backend.callOperation = vi.fn(async <T>(method: string, _payload?: unknown): Promise<T> => (method === 'check' ? { ok: true, issues: [] } : { ok: true, mappings: 1, archived: 2, durationSec: 3, errors: 0 }) as T) as typeof api.backend.callOperation
    api.notifications.notify = vi.fn(async () => true)
    await operations.run()
    const calls = vi.mocked(api.backend.callOperation).mock.calls
    expect(calls.map(([method]) => method)).toEqual(['check', 'run'])
    const checked = (calls[0][1] as { plan: unknown }).plan
    expect((calls[1][1] as { plan: unknown }).plan).toEqual(checked)
    expect(checked).toMatchObject({ label: 'Fern archive', retention: { keepDays: 7, dailies: 30, weeklies: 8 } })
    expect(checked).not.toHaveProperty('profileId')
    expect(calls[1][1]).toMatchObject({ identity: { profileId: 'fern', profileName: 'Fern archive', trigger: 'manual', id: expect.any(String), startedAt: expect.any(String) } })
    expect((await operations.history()).rows).toEqual([])
    expect(api.notifications.notify).not.toHaveBeenCalled()
    operations.dispose()
    store.dispose()
  })
})

describe('Backup archive confirmation ownership', () => {
  const pruneResult = { dropped: ['archive'], kept: 2, errors: [] }
  const restoreResult = { ok: true, creates: ['new'], updates: ['changed'], deletes: [] }
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => { resolve = done })
    return { promise, resolve }
  }
  function fixture() {
    const profiles = [
      { id: 'forest', name: 'Forest', retention: 'off', mappings: [
        { source: '/fixtures/ferns', destination: '/backups/ferns', exclude: ['*.tmp'] },
        { source: '/fixtures/mosses', destination: '/backups/mosses', exclude: [] }
      ] },
      { id: 'wetlands', name: 'Wetlands', retention: 'standard', mappings: [{ source: '/fixtures/reeds', destination: '/backups/reeds', exclude: [] }] }
    ]
    const mock = createMockValleyApi({ manifest: { id: 'backup' }, settings: { activeProfileId: 'forest', profiles } })
    const { api } = mock
    const elements = vi.fn(api.React.createElement)
    api.React = { ...api.React, createElement: elements as unknown as typeof api.React.createElement }
    api.backend.callOperation = vi.fn(async (method: string) => method === 'prune' ? pruneResult : restoreResult) as typeof api.backend.callOperation
    const dispose = register(api)
    const view = (id: string) => (api.registerView as unknown as { mock: { calls: [string, ComponentType][] } }).mock.calls.find(([name]) => name === id)![1]
    const rendered = render(React.createElement(view('backup.panel')))
    fireEvent.click(screen.getByRole('tab', { name: 'Archives' }))
    const callback = (label: string): (() => void) => {
      const entry = [...elements.mock.calls].reverse().find((args) => args[0] === 'button' && args[2] === label)
      expect(entry).toBeDefined()
      return (entry![1] as { onClick: () => void }).onClick
    }
    const select = async (id: string) => {
      fireEvent.click(screen.getByRole('button', { name: 'Backup profile' }))
      const item = mock.menus.at(-1)!.find((entry) => 'id' in entry && entry.id === id)
      if (!item || !('onSelect' in item)) throw new Error('Missing profile menu entry')
      await act(async () => { item.onSelect?.() })
    }
    const preview = async (kind: 'prune' | 'restore') => {
      fireEvent.click(kind === 'prune' ? screen.getByRole('button', { name: 'Clean up…' }) : screen.getAllByRole('button', { name: 'Restore…' })[1])
      const label = kind === 'prune' ? 'Remove' : 'Apply restore'
      await screen.findByRole('button', { name: label })
      return callback(label)
    }
    return { ...mock, profiles, dispose, rendered, view, callback, select, preview }
  }

  it('shows excluded configuration and missing datasets in both restore preview and result', async () => {
    const f = fixture()
    vi.mocked(f.api.backend.callOperation).mockResolvedValue({ ...restoreResult, skipped: ['.valley/', '.valley/plugin-data/field/durable.db'] })
    const confirm = await f.preview('restore')
    expect(screen.getByRole('status')).toHaveTextContent('Excluded from this restore: .valley/, .valley/plugin-data/field/durable.db')
    await act(async () => { confirm() })
    expect(screen.getByRole('status')).toHaveTextContent('Excluded from this restore: .valley/, .valley/plugin-data/field/durable.db')
    expect(screen.queryByRole('button', { name: 'Apply restore' })).not.toBeInTheDocument()
    await f.dispose()
  })

  it.each(['prune', 'restore'] as const)('rejects a captured %s confirmation after switching away and back', async (kind) => {
    const f = fixture()
    const confirm = await f.preview(kind)
    await f.select('wetlands')
    await f.select('forest')
    await act(async () => { confirm() })
    expect(f.api.backend.callOperation).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: kind === 'prune' ? 'Remove' : 'Apply restore' })).not.toBeInTheDocument()
    await f.dispose()
  })

  it.each(['retention', 'mapping', 'reorder'] as const)('permanently invalidates confirmation after a %s edit, including edit then revert', async (change) => {
    const f = fixture()
    const confirm = await f.preview(change === 'retention' ? 'prune' : 'restore')
    const edited = structuredClone(f.profiles)
    if (change === 'retention') edited[0].retention = 'standard'
    if (change === 'mapping') edited[0].mappings[1].destination = '/backups/changed'
    if (change === 'reorder') edited[0].mappings.reverse()
    await act(async () => { await f.api.settings.set('profiles', edited) })
    await act(async () => { await f.api.settings.set('profiles', f.profiles) })
    await act(async () => { confirm() })
    expect(f.api.backend.callOperation).toHaveBeenCalledTimes(1)
    await f.dispose()
  })

  it.each(['prune', 'restore'] as const)('applies the exact previewed %s plan once even if confirmation is invoked twice', async (kind) => {
    const f = fixture()
    const confirm = await f.preview(kind)
    const previewPayload = vi.mocked(f.api.backend.callOperation).mock.calls[0][1]
    const held = deferred<unknown>()
    vi.mocked(f.api.backend.callOperation).mockImplementationOnce(() => held.promise)
    await act(async () => { confirm(); confirm() })
    expect(f.api.backend.callOperation).toHaveBeenCalledTimes(2)
    const [method, payload, options] = vi.mocked(f.api.backend.callOperation).mock.calls[1]
    expect(method).toBe(kind === 'prune' ? 'prune' : 'restoreApply')
    expect(payload).toEqual(kind === 'prune' ? { ...(previewPayload as object), dryRun: false } : previewPayload)
    expect(options?.cancellation?.aborted).toBe(false)
    if (kind === 'restore') expect(payload).toMatchObject({ mappingIndex: 1, plan: { retention: null } })
    await act(async () => { held.resolve(kind === 'prune' ? pruneResult : restoreResult) })
    await f.dispose()
  })

  it.each(['selection', 'vault', 'unmount'] as const)('aborts a delayed preview on %s change and suppresses its late confirmation', async (change) => {
    const f = fixture()
    const held = deferred<unknown>()
    vi.mocked(f.api.backend.callOperation).mockImplementationOnce(() => held.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Clean up…' }))
    await waitFor(() => expect(f.api.backend.callOperation).toHaveBeenCalledTimes(1))
    const signal = vi.mocked(f.api.backend.callOperation).mock.calls[0][2]?.cancellation
    if (change === 'selection') await f.select('wetlands')
    if (change === 'vault') act(() => f.emitState({ vault: { path: '/fixtures/other', name: 'other', displayName: 'Other' } }))
    if (change === 'unmount') f.rendered.unmount()
    expect(signal?.aborted).toBe(true)
    await act(async () => { held.resolve(pruneResult) })
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(f.api.backend.callOperation).toHaveBeenCalledTimes(1)
    await f.dispose()
  })

  it('revokes cancelled confirmation callbacks without submitting maintenance', async () => {
    const f = fixture()
    const confirm = await f.preview('restore')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await act(async () => { confirm() })
    expect(f.api.backend.callOperation).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Apply restore' })).not.toBeInTheDocument()
    await f.dispose()
  })

  it('joins an accepted apply during disposal without removing a replacement registration’s styles', async () => {
    const f = fixture()
    const confirm = await f.preview('restore')
    const held = deferred<unknown>()
    vi.mocked(f.api.backend.callOperation).mockImplementationOnce(() => held.promise)
    await act(async () => { confirm() })
    let drained = false
    const disposal = f.dispose()
    expect(f.dispose()).toBe(disposal)
    void disposal.then(() => { drained = true })
    expect(vi.mocked(f.api.backend.callOperation).mock.calls[1][2]?.cancellation?.aborted).toBe(true)
    const replacement = register(f.api)
    await act(async () => { await Promise.resolve() })
    expect(drained).toBe(false)
    await act(async () => { held.resolve(restoreResult); await disposal })
    expect(document.querySelectorAll('#notes-backup-styles')).toHaveLength(1)
    expect(screen.queryByText(/^Restored 2 file\(s\)/)).not.toBeInTheDocument()
    expect(f.api.backend.callOperation).toHaveBeenCalledTimes(2)
    await replacement()
  })

  it('handles dirty profile drafts without dispatching a preview', async () => {
    const f = fixture()
    render(React.createElement(f.view('backup.settings')))
    fireEvent.click(screen.getByRole('button', { name: /Forest.*Folders/ }))
    await act(async () => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Profile name 1' }), { target: { value: 'Unsaved forest' } })
      fireEvent.click(screen.getByRole('button', { name: 'Clean up…' }))
    })
    expect(screen.getByText('Cleanup failed')).toBeInTheDocument()
    expect(f.api.backend.callOperation).not.toHaveBeenCalled()
    await f.dispose()
  })
})
