import { provideBookmarkSurface, type ValleyPluginApi, type ValleyPluginModule } from '@valley/plugin-sdk'
import { initLocalization, uiText } from './localization'
import { injectStyles } from './styles'
import { createBackupOperations, registerBackupCommands } from './commands'
import { createProfileStore, str } from './profiles'
import { createBackupIcons } from './icons'
import { createBackupPanel, type BackupView } from './Panel'
import { createBackupSettings } from './Settings'
import { createBackupPanelState } from './panelState'
import { createBackupScheduler } from './scheduler'
import type { InteropValueSchema } from '@valley/plugin-sdk'

const bookmarkStateSchema = {
  "type": "object",
  "properties": {
    "profileId": {
      "type": "string"
    },
    "tab": {
      "type": "union",
      "anyOf": [
        {
          "type": "literal",
          "value": "status"
        },
        {
          "type": "literal",
          "value": "details"
        },
        {
          "type": "literal",
          "value": "recent"
        }
      ]
    }
  },
  "required": [
    "profileId",
    "tab"
  ],
  "additionalProperties": false
} satisfies InteropValueSchema



export function register(api: ValleyPluginApi): () => Promise<void> {
  initLocalization(api)
  const disposeStyles = injectStyles()
  const React = api.React
  const profileStore = createProfileStore(api)
  const operations = createBackupOperations(api, profileStore)
  let backupView = { profileId: str(api.settings.get().activeProfileId), tab: 'status' as BackupView['tab'] }
  let disposal: Promise<void> | undefined
  const viewListeners = new Set<() => void>()
  const emitView = (): void => { for (const listener of viewListeners) listener() }
  const subscribeView = (listener: () => void): (() => void) => { viewListeners.add(listener); return () => { viewListeners.delete(listener) } }
  const updateView = (patch: Partial<typeof backupView>): void => {
    const next = { ...backupView, ...patch }
    if (next.profileId === backupView.profileId && next.tab === backupView.tab) return
    backupView = next
    emitView()
  }
  const offNotification = api.notifications.onAction(event => {
    if (event.action !== 'click') return
    if (event.targetItemId) updateView({ profileId: event.targetItemId, tab: 'recent' })
    api.workspace.revealOwnPanel('left_sidebar')
  })
  const offProfileView = profileStore.subscribe(emitView)

  const icons = createBackupIcons(React)
  const panelState = createBackupPanelState(api, operations)
  const scheduler = createBackupScheduler(api, { store: profileStore, operations, panel: panelState })
  const BackupPanel = createBackupPanel(api, { getSnapshot: () => backupView, subscribe: subscribeView, update: updateView }, icons, panelState, scheduler, profileStore)
  const SettingsView = createBackupSettings(api, profileStore, icons)

  api.registerView('backup.panel', BackupPanel)
  api.registerView('backup.settings', SettingsView)

  const offCommand = registerBackupCommands(api, profileStore, operations, scheduler.getSnapshot)
  const offSurface = provideBookmarkSurface(api, {
    id: 'backup.panel', surface: 'left_sidebar', subscribe: subscribeView,
    getSnapshot: () => {
      const profile = profileStore.getSnapshot().find((item) => item.id === backupView.profileId)
      return { title: 'Backup', view: { ...backupView }, ...(profile ? { item: { id: profile.id, title: profile.name, state: { ...backupView } } } : {}) }
    },
    restore: (state) => {
      const profileId = typeof state.profileId === 'string' ? state.profileId : ''
      if (profileId && !profileStore.getSnapshot().some((item) => item.id === profileId)) throw new Error('Backup profile is unavailable')
      const tab = ['status', 'details', 'recent'].includes(String(state.tab)) ? state.tab as BackupView['tab'] : 'status'
      updateView({ profileId, tab })
    }
  }, { stateSchema: bookmarkStateSchema, itemStateSchema: { ...bookmarkStateSchema, required: [...bookmarkStateSchema.required, "profileId"] }, description: (snapshot, item) => typeof snapshot.view.path === 'string' && snapshot.view.path ? snapshot.view.path : uiText(item ? 'bookmark.item' : 'bookmark.view') })
  return () => {
    if (disposal) return disposal
    const schedulerDrain = scheduler.dispose()
    const panelDrain = panelState.dispose()
    const drained = offCommand()
    offSurface()
    offNotification()
    offProfileView()
    viewListeners.clear()
    disposeStyles()
    return disposal = Promise.allSettled([schedulerDrain, drained, panelDrain]).then(() => {
      profileStore.dispose()
    })
  }
}

const plugin: ValleyPluginModule = { register }
export default plugin
