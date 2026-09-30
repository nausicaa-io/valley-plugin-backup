import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { createBackupOperations } from './commands'
import type { createBackupPanelState } from './panelState'
import type { createProfileStore } from './profiles'

export interface ScheduleStatus {
  /** When the next scheduled backup is expected (now while one is due). */
  nextAt: number | null
  /** Why a due backup cannot start yet — typically an unplugged drive. */
  waiting: string | null
}

type Operations = Pick<ReturnType<typeof createBackupOperations>, 'isActive' | 'check' | 'history' | 'status'>
type Panel = Pick<ReturnType<typeof createBackupPanelState>, 'start' | 'isRunning'>
type Store = Pick<ReturnType<typeof createProfileStore>, 'getSnapshot' | 'subscribe' | 'assertClean'>

/**
 * Runs each profile's schedule while Valley is open. Every minute it looks for
 * a due slot; a slot missed while the app was closed is due at the next launch.
 * A due profile whose drive is missing is re-checked each minute — so it starts
 * soon after the drive is connected — and notifies once per slot. The history
 * row a scheduled run inserts under its slot id is what claims the slot, so a
 * second window never starts the same backup.
 */
export function createBackupScheduler(
  api: ValleyPluginApi,
  _deps: { store: Store; operations: Operations; panel: Panel },
  _timing: { firstMs: number; everyMs: number; refreshMs: number } = { firstMs: 60_000, everyMs: 60_000, refreshMs: 500 }
) {
  let statuses: Record<string, ScheduleStatus> = {}
  let active = true
  const listeners = new Set<() => void>()
  const publish = (value: unknown): void => {
    if (!active || !value || typeof value !== 'object') return
    statuses = value as Record<string, ScheduleStatus>
    for (const listener of listeners) listener()
  }
  const off = api.backend.on('backup.schedule', publish)
  const tick = async (): Promise<void> => { publish(await api.backend.call('schedule.snapshot')) }
  void tick().catch(() => {})
  return {
    getSnapshot: () => statuses,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener) } },
    tick,
    dispose: async (): Promise<void> => { active = false; off(); listeners.clear() }
  }
}
