import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import { createMockValleyApi } from '@valley/plugin-testkit'
import { register } from '../src/index'
import { initLocalization, uiText } from '../src/localization'
import { createProfileStore } from '../src/profiles'
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
    expect(screen.getByRole('textbox', { name: 'Trash folder' })).toHaveValue('/backups/trash')
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
    fireEvent.click(screen.getByRole('button', { name: '+ Add folder pair 1' }))

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
    api.drivers.backup.check = vi.fn(async () => ({ ok: false, error: 'Source is unavailable' }))
    api.drivers.backup.run = vi.fn()
    try {
      expect(await api.commands.execute('backup:profile-read', { profileId: 'missing' })).toMatchObject({ ok: false, error: { message: expect.stringContaining('not found') } })
      expect(await api.commands.execute('backup:run', { profileId: 'forest' })).toMatchObject({ ok: false, error: { message: 'Source is unavailable' } })
      expect(api.drivers.backup.run).not.toHaveBeenCalled()
    } finally { off(); store.dispose() }
  })
})
