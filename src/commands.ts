import { backupApi } from './backupApi'
import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { MirrorProgress } from './types'
import { uiText } from './localization'
import { genId, parseProfiles, serializeProfile, mirrorPlan, type createProfileStore, type Profile } from './profiles'

type ProfileStore = ReturnType<typeof createProfileStore>
type ProfileTarget = { profileId?: string }
const targetSchema = { type: 'object', properties: { profileId: { type: 'string' } }, additionalProperties: false }

function object(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected an object')
  return raw as Record<string, unknown>
}

function target(raw: unknown): ProfileTarget {
  const value = object(raw).profileId
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) throw new Error('profileId must be a nonempty string')
  return value ? { profileId: String(value) } : {}
}

const targetInput = { schema: targetSchema, parse: target, fromCli: (args: string[], flags: Record<string, string | boolean>) => ({ profileId: flags.profile ?? args[0] }) }
const profileFields = {
  name: { type: 'string', minLength: 1 },
  mappings: { type: 'array', items: { type: 'object', properties: { source: { type: 'string' }, destination: { type: 'string' }, exclude: { type: 'array', items: { type: 'string' } } }, required: ['source', 'destination'], additionalProperties: false } },
  trashPath: { type: 'string' }, logDirectory: { type: 'string' }, masterLog: { type: 'string' }
}

function profilePatch(raw: unknown): Record<string, unknown> {
  const values = object(raw)
  for (const [key, value] of Object.entries(values)) {
    if (!(key in profileFields)) throw new Error(`Unknown profile field: ${key}`)
    if (key === 'mappings') {
      if (!Array.isArray(value)) throw new Error('mappings must be an array')
      for (const entry of value) {
        const mapping = object(entry)
        if (typeof mapping.source !== 'string' || typeof mapping.destination !== 'string') throw new Error('A mapping requires source and destination paths')
        if (mapping.exclude !== undefined && (!Array.isArray(mapping.exclude) || !mapping.exclude.every((item) => typeof item === 'string'))) throw new Error('Mapping exclusions must be strings')
        if (Object.keys(mapping).some((field) => !['source', 'destination', 'exclude'].includes(field))) throw new Error('Unknown mapping field')
      }
    } else if (typeof value !== 'string' || (key === 'name' && !value.trim())) throw new Error(`Invalid ${key}`)
  }
  return values
}

export function createBackupOperations(api: ValleyPluginApi, store: ProfileStore) {
  let running = false
  let runningProfileId: string | null = null
  let latestProgress: MirrorProgress | null = null
  const offProgress = backupApi(api).onProgress((progress) => { latestProgress = progress })
  const profile = (profileId?: string): Profile => {
    const profiles = store.getSnapshot()
    const id = profileId ?? String(api.settings.get().activeProfileId ?? '')
    const selected = id ? profiles.find((item) => item.id === id) : profiles[0]
    if (!selected) throw new Error(`Backup profile not found: ${id || '(none configured)'}`)
    return selected
  }
  const history = (limit = 50, cursor?: string) => api.data.dataset('backup_runs').query({ orderBy: [{ field: 'startedAt', direction: 'desc' }], limit, cursor })
  const run = async (profileId?: string, prechecked = false) => {
    store.assertClean()
    if (running) throw new Error('A backup is already running. Check backup:status before starting another.')
    const selected = profile(profileId)
    const plan = mirrorPlan(selected)
    running = true
    runningProfileId = selected.id
    latestProgress = null
    try {
    if (!prechecked) {
      const checked = await backupApi(api).check(plan)
      if (!checked.ok || !checked.data?.ok) throw new Error(checked.error ?? checked.data?.issues.map((issue) => issue.message).join('; ') ?? 'Backup precheck failed')
    }
    const startedAt = new Date().toISOString()
    const result = await backupApi(api).run(plan)
    if (result.data) {
      const data = result.data
      await api.data.dataset('backup_runs').insert({ id: crypto.randomUUID(), startedAt, profileName: selected.name, durationSec: data.durationSec, archived: data.archived, errors: data.errors, ok: data.ok, reason: data.ok ? null : data.message ?? null })
      const records = await history(1000)
      for (const stale of records.rows.slice(50)) await api.data.dataset('backup_runs').delete({ id: String(stale.id) })
    }
    await api.notifications.notify(result.ok && result.data?.ok ? 'finished' : 'failed', {
      title: uiText(result.ok && result.data?.ok ? 'backup.notification.finished' : 'backup.notification.failed'),
      body: selected.name
    })
    return result
    } catch (error) {
      await api.notifications.notify('failed', { title: uiText('backup.notification.failed'), body: selected.name })
      throw error
    } finally { running = false }
  }
  const replace = async (next: Profile[], before: Profile[]) => {
    store.assertClean()
    await store.save(next)
    const expected = JSON.stringify(next.map(serializeProfile))
    return {
      value: next.map(serializeProfile),
      revert: {
        label: 'Update backup profiles',
        run: async () => {
          store.assertClean()
          if (JSON.stringify(store.getSnapshot().map(serializeProfile)) !== expected) throw new Error('Backup profiles changed after this operation')
          await store.save(before)
        }
      }
    }
  }
  const update = async (profileId: string, values: Record<string, unknown>) => {
    const selected = profile(profileId)
    const patch = profilePatch(values)
    const before = store.getSnapshot()
    const [next] = parseProfiles({ profiles: [{ ...serializeProfile(selected), ...patch }] })
    return replace(before.map((item) => item.id === selected.id ? next : item), before)
  }
  return { profile, plan: (profileId?: string, forceRetention = false) => { store.assertClean(); return mirrorPlan(profile(profileId), forceRetention) }, history, run, replace, update, status: () => ({ running, profileId: runningProfileId, progress: latestProgress }), dispose: offProgress }
}

export function registerBackupCommands(api: ValleyPluginApi, store: ProfileStore, operations: ReturnType<typeof createBackupOperations>): () => void {
  const profileRevision = ({ profileId }: ProfileTarget) => serializeProfile(operations.profile(profileId))
  const prunePreview = async ({ profileId }: ProfileTarget) => {
    const result = await backupApi(api).prune(operations.plan(profileId, true), { dryRun: true })
    if (!result.ok || !result.data || result.data.errors.length) throw new Error(result.error ?? result.data?.errors.map((entry) => entry.message).join('; ') ?? 'Could not inspect backup retention')
    return result.data
  }
  const restorePreview = async ({ profileId, mappingIndex }: { profileId: string; mappingIndex: number }) => {
    const result = await backupApi(api).restorePlan(operations.plan(profileId), mappingIndex)
    if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.message ?? 'Could not inspect this restore')
    return result.data
  }
  const mappingInput = {
    schema: { ...targetSchema, properties: { ...targetSchema.properties, mappingIndex: { type: 'integer', minimum: 0 } }, required: ['mappingIndex'] },
    parse: (raw: unknown) => {
      const selected = target(raw), mappingIndex = Number(object(raw).mappingIndex)
      if (!Number.isInteger(mappingIndex) || mappingIndex < 0) throw new Error('mappingIndex must be a nonnegative integer')
      const profile = operations.profile(selected.profileId)
      if (!profile.rows[mappingIndex]) throw new Error('Backup mapping does not exist')
      return { profileId: profile.id, mappingIndex }
    }
  }
  const off = [
    api.commands.register({ id: 'status', label: 'Backup progress', labelKey: 'backup.surface.status', sideEffect: 'read', paletteSafe: false, run: operations.status }),
    api.commands.register({ id: 'profiles', label: 'List backup profiles', labelKey: 'backup.surface.profiles', paletteSafe: false, sideEffect: 'read', run: () => store.getSnapshot().map(serializeProfile) }),
    api.commands.register({ id: 'profile-read', label: 'Read backup profile', labelKey: 'backup.surface.profile-read', paletteSafe: false, sideEffect: 'read', input: targetInput, run: ({ profileId }) => serializeProfile(operations.profile(profileId)) }),
    api.commands.register({ id: 'profile-create', label: 'Create backup profile', labelKey: 'backup.surface.profile-create', paletteSafe: false, sideEffect: 'write',
      input: { schema: { type: 'object', properties: profileFields, required: ['name'], additionalProperties: false }, parse: (raw) => { const value = profilePatch(raw); if (typeof value.name !== 'string') throw new Error('name is required'); return value } },
      revision: () => store.getSnapshot().map(serializeProfile), preview: (values) => ({ action: 'create-profile', values }),
      run: async (values) => { const before = store.getSnapshot(); const next = parseProfiles({ profiles: [{ id: genId(), ...values }] }); return operations.replace([...before, ...next], before) }
    }),
    api.commands.register({ id: 'profile-update', label: 'Update backup profile', labelKey: 'backup.surface.profile-update', paletteSafe: false, sideEffect: 'write',
      input: { schema: { type: 'object', properties: { profileId: { type: 'string' }, values: { type: 'object', properties: profileFields, additionalProperties: false } }, required: ['profileId', 'values'], additionalProperties: false }, parse: (raw) => { const selected = target(raw); if (!selected.profileId) throw new Error('profileId is required'); return { profileId: selected.profileId, values: profilePatch(object(raw).values) } } },
      revision: (input) => profileRevision(input), preview: (input) => input, run: ({ profileId, values }) => operations.update(profileId, values)
    }),
    api.commands.register({ id: 'profile-delete', label: 'Delete backup profile', labelKey: 'backup.surface.profile-delete', paletteSafe: false, sideEffect: 'write', input: targetInput,
      revision: profileRevision, preview: ({ profileId }) => ({ action: 'delete-profile', profile: serializeProfile(operations.profile(profileId)) }),
      run: async ({ profileId }) => { const selected = operations.profile(profileId); const before = store.getSnapshot(); return operations.replace(before.filter((item) => item.id !== selected.id), before) }
    }),
    api.commands.register({ id: 'check', label: 'Check backup profile', labelKey: 'backup.surface.check', paletteSafe: false, sideEffect: 'read', input: targetInput, run: async ({ profileId }) => {
      const result = await backupApi(api).check(operations.plan(profileId))
      if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.issues.map((issue) => issue.message).join('; ') ?? 'Backup precheck failed')
      return result.data
    } }),
    api.commands.register({ id: 'run', label: 'Backup now', labelKey: 'auto.5d5dba0742de', sideEffect: 'write', input: targetInput,
      revision: profileRevision, preview: ({ profileId }) => backupApi(api).check(operations.plan(profileId)),
      run: async ({ profileId }) => { const result = await operations.run(profileId); if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.message ?? 'Backup failed'); return { value: result.data, revert: null } }
    }),
    api.commands.register({ id: 'history', label: 'Read backup history', labelKey: 'backup.surface.history', paletteSafe: false, sideEffect: 'read',
      input: { schema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 500 }, cursor: { type: 'string' } } }, parse: (raw) => { const value = object(raw), limit = Number(value.limit ?? 50); if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (value.cursor !== undefined && typeof value.cursor !== 'string')) throw new Error('Invalid pagination'); return { limit, cursor: value.cursor as string | undefined } } },
      run: ({ limit, cursor }) => operations.history(limit, cursor)
    }),
    api.commands.register({ id: 'prune-preview', label: 'Preview backup retention', labelKey: 'backup.surface.prune-preview', paletteSafe: false, sideEffect: 'read', input: targetInput, run: prunePreview }),
    api.commands.register({ id: 'prune', label: 'Apply backup retention', labelKey: 'backup.surface.prune', paletteSafe: false, sideEffect: 'write', input: targetInput,
      revision: async (input) => ({ profile: profileRevision(input), plan: await prunePreview(input) }), preview: prunePreview,
      run: async ({ profileId }) => { const result = await backupApi(api).prune(operations.plan(profileId, true), { dryRun: false }); if (!result.ok || result.data?.errors.length) throw new Error(result.error ?? `Retention did not finish. ${result.data?.dropped.length ?? 0} archives were removed; inspect history before retrying.`); return { value: result.data, revert: null } }
    }),
    api.commands.register({ id: 'restore-preview', label: 'Preview backup restore', labelKey: 'backup.surface.restore-preview', paletteSafe: false, sideEffect: 'read', input: mappingInput, run: restorePreview }),
    api.commands.register({ id: 'restore', label: 'Restore backup mapping', labelKey: 'backup.surface.restore', paletteSafe: false, sideEffect: 'write', input: mappingInput,
      revision: async (input) => ({ profile: profileRevision(input), plan: await restorePreview(input) }), preview: restorePreview,
      run: async ({ profileId, mappingIndex }) => { const result = await backupApi(api).restoreApply(operations.plan(profileId), mappingIndex); if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.message ?? 'Restore failed'); return { value: result.data, revert: null } }
    })
  ]
  return () => { for (const dispose of off) dispose(); operations.dispose() }
}
