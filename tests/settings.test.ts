import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { createMockValleyApi } from '@valley/plugin-testkit'
import { register } from '../src/index'
import { initLocalization, uiText } from '../src/localization'
import { createProfileStore, mirrorPlan, parseProfiles, serializeProfile } from '../src/profiles'
import { createBackupOperations, registerBackupCommands } from '../src/commands'
import { createHistoryStore, HISTORY_FILE } from '../src/history'

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
    api.backend.call = vi.fn(async () => ({ field: { nextAt: next.getTime(), waiting: null } })) as unknown as unknown as typeof api.backend.call
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    expect(await screen.findByText(/^Next backup (today|tomorrow) 02:00$/)).toBeInTheDocument()
    await dispose()
  })

  it('switches the deleted-files and log options per profile and lists every folder pair', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith({ trashPath: '/backups/deleted-files', logDirectory: '/backups/logs', mappings: [{ source: '/fixtures/ferns', destination: '/backups/ferns' }, { name: 'Mosses', source: '/fixtures/moss', destination: '/backups/moss' }] }) })
    const saved = () => (api.settings.get().profiles as Array<{ noArchive?: boolean; noLogs?: boolean }>)[0]
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    const keep = await screen.findByRole('checkbox', { name: 'Keep deleted files' })
    const log = screen.getByRole('checkbox', { name: 'Write log' })
    expect(keep).toBeChecked()
    expect(log).toBeChecked()
    expect(screen.getByText('/backups/deleted-files')).toBeInTheDocument()
    expect(screen.getByText('/backups/logs')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
    expect(screen.getByText('Log')).toBeInTheDocument()
    expect(screen.getByText('ferns')).toBeInTheDocument()
    expect(screen.getByText('/fixtures/moss')).toBeInTheDocument()
    expect(screen.getByText('/backups/moss')).toBeInTheDocument()
    expect(screen.getByText('Mosses')).toBeInTheDocument()

    fireEvent.click(keep)
    await waitFor(() => expect(saved().noArchive).toBe(true))
    expect(await screen.findByText('Changed and deleted files are removed permanently.')).toBeInTheDocument()
    fireEvent.click(log)
    await waitFor(() => expect(saved().noLogs).toBe(true))
    expect(mirrorPlan(parseProfiles(api.settings.get())[0])).toMatchObject({ noArchive: true, noLogs: true })
    expect(serializeProfile(parseProfiles(api.settings.get())[0])).toMatchObject({ noArchive: true, noLogs: true })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Keep deleted files' }))
    await waitFor(() => expect(saved().noArchive).toBeUndefined())
    expect(screen.queryByText('Changed and deleted files are removed permanently.')).not.toBeInTheDocument()
    await dispose()
  })

  it('keeps the Archive and Log folder buttons clickable when no path is set', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith({ trashPath: '', logDirectory: '', mappings: [{ source: '/fixtures/ferns', destination: '/backups/ferns' }] }) })
    const backendCall = vi.fn(async () => true)
    api.backend.call = backendCall as unknown as typeof api.backend.call
    const settings = vi.spyOn(api.workspace, 'openOwnSettings')
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    const options = (await screen.findByRole('checkbox', { name: 'Keep deleted files' })).closest('.backup-options') as HTMLElement
    const [archive, log] = Array.from(options.querySelectorAll('button'))
    expect(archive).toBeEnabled()
    expect(log).toBeEnabled()
    fireEvent.click(archive)
    await waitFor(() => expect(backendCall).toHaveBeenCalledWith('reveal', expect.objectContaining({ path: '/backups/ferns' })))
    fireEvent.click(log)
    expect(settings).toHaveBeenCalled()
    await dispose()
  })

  it('skips an unticked folder in runs while restore keeps every folder index', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith({ mappings: [{ source: '/fixtures/ferns', destination: '/backups/ferns' }, { name: 'Mosses', source: '/fixtures/moss', destination: '/backups/moss' }] }) })
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Include ferns in this backup' }))
    await waitFor(() => expect((api.settings.get().profiles as Array<{ mappings: Array<{ disabled?: boolean }> }>)[0].mappings[0].disabled).toBe(true))
    const profile = parseProfiles(api.settings.get())[0]
    expect(mirrorPlan(profile).mappings.map((mapping) => mapping.source)).toEqual(['/fixtures/moss'])
    expect(mirrorPlan(profile, false, true).mappings.map((mapping) => mapping.source)).toEqual(['/fixtures/ferns', '/fixtures/moss'])
    expect(screen.getByRole('button', { name: 'Backup now' })).toBeEnabled()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Mosses in this backup' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Backup now' })).toBeDisabled())
    await dispose()
  })

  it('shows a missing folder unticked and leaves it out of a manual run without changing the saved tick', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith({ mappings: [{ source: '/fixtures/ferns', destination: '/backups/ferns' }, { name: 'Mosses', source: '/fixtures/moss', destination: '/backups/moss' }] }) })
    api.backend.call = vi.fn(async (method: string) => method === 'missingFolders' ? ['/backups/ferns'] : undefined) as unknown as typeof api.backend.call
    const runs: Array<{ mappings: Array<{ source: string }> }> = []
    api.backend.callOperation = vi.fn(async (method: string, payload: { plan: { mappings: Array<{ source: string }> } }) => {
      if (method === 'check') return { ok: true, issues: [] }
      runs.push(payload.plan)
      return { ok: true, mappings: 1, archived: 0, copied: 0, durationSec: 0, errors: 0 }
    }) as unknown as typeof api.backend.callOperation
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    fireEvent.click(await screen.findByRole('button', { name: 'Backup now' }))
    await waitFor(() => expect(runs).toHaveLength(1))
    expect(runs[0].mappings.map((mapping) => mapping.source)).toEqual(['/fixtures/moss'])
    const ferns = await screen.findByRole('checkbox', { name: 'Include ferns in this backup' })
    expect(ferns).not.toBeChecked()
    expect(ferns).toBeDisabled()
    expect(screen.getByText('Folder not found. Skipped.')).toBeInTheDocument()
    expect((api.settings.get().profiles as Array<{ mappings: Array<{ disabled?: boolean }> }>)[0].mappings[0].disabled).toBeUndefined()
    await dispose()
  })

  it('does not start when no selected folder exists', async () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' }, settings: settingsWith({ mappings: [{ source: '/fixtures/ferns', destination: '/backups/ferns' }] }) })
    api.backend.call = vi.fn(async (method: string) => method === 'missingFolders' ? ['/fixtures/ferns'] : undefined) as unknown as typeof api.backend.call
    api.backend.callOperation = vi.fn() as unknown as typeof api.backend.callOperation
    const dispose = register(api)
    render(React.createElement(viewOf(api, 'backup.panel')))
    fireEvent.click(await screen.findByRole('button', { name: 'Backup now' }))
    expect(await screen.findByText('None of the selected folders were found.')).toBeInTheDocument()
    expect(api.backend.callOperation).not.toHaveBeenCalled()
    await dispose()
  })
})

describe('Backup localization', () => {
  it('uses plugin translations first and preserves English interpolation fallbacks', () => {
    const { api } = createMockValleyApi({ manifest: { id: 'backup' } })
    api.ui.t = (key) => key === 'auto.432e860f10ff' ? '备份设置' : key
    initLocalization(api)

    expect(uiText('auto.432e860f10ff')).toBe('备份设置')
    expect(uiText('auto.8b35536332aa')).toBe(' error(s)')
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
      expect(await api.commands.execute('backup:profile-run', { profileId: 'forest' })).toMatchObject({ ok: false, error: { message: 'Source is unavailable' } })
      expect(vi.mocked(api.backend.callOperation).mock.calls.map(([method]) => method)).toEqual(['check'])
    } finally { off(); store.dispose() }
  })
})

describe('Backup command refusals', () => {
  it('reports unknown profiles, mismatched history rows and a failed precheck as not applied before any effect', async () => {
    const mock = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'forest', name: 'Forest', mappings: [] }] } })
    const { api } = mock
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const off = registerBackupCommands(api, store, operations)
    api.backend.callOperation = vi.fn(async () => { throw new Error('Source is unavailable') })
    const command = (id: string) => mock.commands.find((entry) => entry.id === id)!
    const attempt = async (id: string, input: unknown) => {
      const target = command(id), parsed = target.input ? target.input.parse(input) : input
      await target.revision?.(parsed as never)
      return target.run(parsed as never, { caller: 'agent', dryRun: false, services: { undo: () => {} } } as never)
    }
    const refused = (code: string) => ({ code, outcome: 'not-applied', retryable: false })
    try {
      const history = createHistoryStore(api)
      await history.insert({ id: 'run', startedAt: '2026-09-29T08:00:00Z', profileName: 'Forest', ok: true })
      const before = { settings: JSON.stringify(api.settings.get()), history: await api.data.files.readText(HISTORY_FILE) }
      await expect(attempt('profile-update', { profileId: 'missing', values: { name: 'Gone' } })).rejects.toMatchObject(refused('NOT_FOUND'))
      await expect(attempt('profile-delete', { profileId: 'missing' })).rejects.toMatchObject(refused('NOT_FOUND'))
      await expect(attempt('profile-run', { profileId: 'missing' })).rejects.toMatchObject(refused('NOT_FOUND'))
      expect(() => command('profile-update').input!.parse({ profileId: 'forest', values: { colour: 'green' } })).toThrow(expect.objectContaining(refused('INVALID_INPUT')))
      await expect(attempt('history-remove', { id: 'run', record: { id: 'run', startedAt: '2026-09-29T08:00:00Z', profileName: 'Forest', ok: false } })).rejects.toMatchObject(refused('REVISION_CONFLICT'))
      await expect(attempt('profile-run', { profileId: 'forest' })).rejects.toMatchObject(refused('PRECHECK_FAILED'))
      expect(vi.mocked(api.backend.callOperation).mock.calls.map(([method]) => method)).toEqual(['check'])
      expect({ settings: JSON.stringify(api.settings.get()), history: await api.data.files.readText(HISTORY_FILE) }).toEqual(before)
    } finally { off(); store.dispose() }
  })
})

describe('Backup history removal', () => {
  it('removes one exact history row through the command bus and reverts to the exact prior file', async () => {
    const mock = createMockValleyApi({ manifest: { id: 'backup' }, settings: { profiles: [{ id: 'forest', name: 'Forest', mappings: [] }] } })
    const { api } = mock
    const store = createProfileStore(api)
    const operations = createBackupOperations(api, store)
    const off = registerBackupCommands(api, store, operations)
    try {
      const history = createHistoryStore(api)
      await history.insert({ id: 'old', startedAt: '2026-09-28T08:00:00Z', profileName: 'Forest', ok: true })
      await history.insert({ id: 'new', startedAt: '2026-09-29T08:00:00Z', profileName: 'Forest', ok: false, reason: 'stopped' })
      const before = await api.data.files.readText(HISTORY_FILE)
      expect(await api.commands.execute('backup:history-remove', { id: 'new', record: { id: 'new', startedAt: '2026-09-29T08:00:00Z', profileName: 'Forest', ok: true } })).toMatchObject({ ok: false })
      expect(await api.data.files.readText(HISTORY_FILE)).toBe(before)
      expect(mock.busUndo).toHaveLength(0)
      const removed = await api.commands.execute('backup:history-remove', { id: 'new', record: { id: 'new', startedAt: '2026-09-29T08:00:00Z', profileName: 'Forest', ok: false, reason: 'stopped' } })
      expect(removed).toMatchObject({ ok: true, value: { rows: [{ id: 'old' }] } })
      expect((await history.query()).rows.map(entry => entry.id)).toEqual(['old'])
      await mock.busUndo[0].undo()
      expect(await api.data.files.readText(HISTORY_FILE)).toBe(before)
      await mock.busUndo[0].redo!()
      expect((await history.query()).rows.map(entry => entry.id)).toEqual(['old'])
      await history.insert({ id: 'later', startedAt: '2026-09-30T08:00:00Z', profileName: 'Forest', ok: true })
      await expect(mock.busUndo[0].undo()).rejects.toThrow('changed')
      expect((await history.query()).rows.map(entry => entry.id)).toEqual(['later', 'old'])
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
