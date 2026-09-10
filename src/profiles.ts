import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { MirrorPlan } from './types'

export type Row = { source: string; destination: string; excludeText: string }
export type Profile = {
  id: string
  name: string
  rows: Row[]
  trashPath: string
  logDirectory: string
  masterLog: string
  retention?: 'standard' | 'off'
}

export const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

export const genId = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const rowsFromMappings = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.map((m) => {
        const r = (m ?? {}) as Record<string, unknown>
        const exclude = Array.isArray(r.exclude) ? r.exclude.map(String) : []
        return { source: str(r.source), destination: str(r.destination), excludeText: exclude.join(', ') }
      })
    : []

/** Parse the plugin settings blob into editable profiles. */
export const parseProfiles = (s: Record<string, unknown>): Profile[] => {
  if (!Array.isArray(s.profiles)) return []
  return s.profiles
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p, i) => ({
      id: str(p.id).trim() || genId(),
      name: str(p.name).trim() || `Profile ${i + 1}`,
      rows: rowsFromMappings(p.mappings),
      trashPath: str(p.trashPath),
      logDirectory: str(p.logDirectory),
      masterLog: str(p.masterLog),
      retention: p.retention === 'off' ? 'off' : 'standard'
    }))
}

export const serializeProfile = (
  p: Profile
): {
  id: string
  name: string
  mappings: Array<{ source: string; destination: string; exclude: string[] }>
  trashPath: string
  logDirectory: string
  masterLog: string
  retention: 'standard' | 'off'
} => ({
  id: p.id,
  name: p.name.trim() || 'Untitled',
  mappings: p.rows.map((r) => ({
    source: r.source.trim(),
    destination: r.destination.trim(),
    exclude: r.excludeText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  })),
  trashPath: p.trashPath.trim(),
  logDirectory: p.logDirectory.trim(),
  masterLog: p.masterLog.trim(),
  retention: p.retention ?? 'standard'
})

export function createProfileStore(api: ValleyPluginApi) {
  let profiles = parseProfiles(api.settings.get())
  let saved = JSON.stringify(profiles.map(serializeProfile))
  let dirty = false
  let pending = Promise.resolve()
  const listeners = new Set<() => void>()
  const emit = (): void => { for (const listener of listeners) listener() }
  const off = api.settings.subscribe(() => {
    if (dirty) return
    const next = parseProfiles(api.settings.get())
    const serialized = JSON.stringify(next.map(serializeProfile))
    if (serialized === saved) return
    profiles = next
    saved = serialized
    emit()
  })
  const setDraft = (next: Profile[] | ((previous: Profile[]) => Profile[])): void => {
    profiles = typeof next === 'function' ? next(profiles) : next
    dirty = JSON.stringify(profiles.map(serializeProfile)) !== saved
    emit()
  }
  const save = (next: Profile[]): Promise<void> => {
    const value = next.map(serializeProfile)
    setDraft(next)
    const operation = pending.then(async () => {
      if (!(await api.settings.set('profiles', value)).ok) throw new Error('Could not save backup profiles')
      saved = JSON.stringify(value)
      dirty = JSON.stringify(profiles.map(serializeProfile)) !== saved
      emit()
    })
    pending = operation.catch(() => {})
    return operation
  }
  return {
    getSnapshot: () => profiles,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    setDraft,
    save,
    assertClean: () => { if (dirty) throw new Error('Finish editing backup settings before changing profiles through automation') },
    dispose: () => { off(); listeners.clear() }
  }
}

export function mirrorPlan(profile: Profile, forceRetention = false): MirrorPlan {
  const saved = serializeProfile(profile)
  return {
    label: saved.name,
    mappings: saved.mappings.filter((mapping) => mapping.source && mapping.destination),
    trashPath: saved.trashPath,
    logDirectory: saved.logDirectory,
    masterLog: saved.masterLog,
    retention: !forceRetention && saved.retention === 'off' ? null : { keepDays: 7, dailies: 30, weeklies: 8 }
  }
}
