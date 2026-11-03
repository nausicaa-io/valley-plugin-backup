import { commandRegistrar, backupResults } from './commandResults'
import { backupApi } from './backupApi'
import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { CommandContext } from '@valley/plugin-sdk/commands'
import type { MirrorProgress, MirrorResult } from './types'
import { uiText } from './localization'
import { genId, parseProfiles, serializeProfile, mirrorPlan, type createProfileStore, type Profile } from './profiles'
import { formatDuration } from './format'
import { BackupClaimed, createHistoryStore, type RunRecord } from './history'
export { BackupClaimed } from './history'

type ProfileStore = ReturnType<typeof createProfileStore>
type ProfileTarget = { profileId?: string }

export type RunTrigger = 'manual' | 'scheduled' | 'automation'
export interface RunOptions {
  trigger?: RunTrigger
  /** A deterministic history id claims the run: a second insert of it fails. */
  runId?: string
}
/** History reason of a run that started but never recorded an outcome. */
export const RUN_INTERRUPTED = 'interrupted'
/** History reason of a run the user stopped. */
export const RUN_STOPPED = 'stopped'
/** History rows kept; the scheduler reads its last runs from them. */

const refused = (code: string, message: string): Error => Object.assign(new Error(message), { code, outcome: 'not-applied' as const, retryable: false })

const targetSchema = { type: 'object', properties: { profileId: { type: 'string' } }, additionalProperties: false }

function object(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) throw refused('INVALID_INPUT', 'Expected an object')
  return raw as Record<string, unknown>
}

function target(raw: unknown): ProfileTarget {
  const value = object(raw).profileId
  if (value !== undefined && (typeof value !== 'string' || !value.trim())) throw refused('INVALID_INPUT', 'profileId must be a nonempty string')
  return value ? { profileId: String(value) } : {}
}

const targetInput = { schema: targetSchema, parse: target, fromCli: (args: string[], flags: Record<string, string | boolean>) => ({ profileId: flags.profile ?? args[0] }) }
const scheduleFields = {
  every: { type: 'string', enum: ['off', 'hourly', 'daily', 'weekly'] },
  time: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
  weekday: { type: 'integer', minimum: 0, maximum: 6 }
}
const profileFields = {
  name: { type: 'string', minLength: 1 },
  mappings: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, source: { type: 'string' }, destination: { type: 'string' }, exclude: { type: 'array', items: { type: 'string' } } }, required: ['source', 'destination'], additionalProperties: false } },
  trashPath: { type: 'string' }, logDirectory: { type: 'string' }, masterLog: { type: 'string' },
  retention: { type: 'string', enum: ['standard', 'off'] },
  schedule: { type: 'object', properties: scheduleFields, additionalProperties: false }
}

function schedulePatch(raw: unknown): Record<string, unknown> {
  const schedule = object(raw)
  for (const [field, value] of Object.entries(schedule)) {
    if (field === 'every' && !scheduleFields.every.enum.includes(String(value))) throw refused('INVALID_INPUT', 'schedule.every must be off, hourly, daily or weekly')
    else if (field === 'time' && (typeof value !== 'string' || !new RegExp(scheduleFields.time.pattern).test(value))) throw refused('INVALID_INPUT', 'schedule.time must be HH:mm')
    else if (field === 'weekday' && (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 6)) throw refused('INVALID_INPUT', 'schedule.weekday must be 0–6')
    else if (!(field in scheduleFields)) throw refused('INVALID_INPUT', `Unknown schedule field: ${field}`)
  }
  return schedule
}

function profilePatch(raw: unknown): Record<string, unknown> {
  const values = object(raw)
  for (const [key, value] of Object.entries(values)) {
    if (!(key in profileFields)) throw refused('INVALID_INPUT', `Unknown profile field: ${key}`)
    if (key === 'mappings') {
      if (!Array.isArray(value)) throw refused('INVALID_INPUT', 'mappings must be an array')
      for (const entry of value) {
        const mapping = object(entry)
        if (typeof mapping.source !== 'string' || typeof mapping.destination !== 'string') throw refused('INVALID_INPUT', 'A mapping requires source and destination paths')
        if (mapping.name !== undefined && typeof mapping.name !== 'string') throw refused('INVALID_INPUT', 'Mapping name must be a string')
        if (mapping.exclude !== undefined && (!Array.isArray(mapping.exclude) || !mapping.exclude.every((item) => typeof item === 'string'))) throw refused('INVALID_INPUT', 'Mapping exclusions must be strings')
        if (Object.keys(mapping).some((field) => !['name', 'source', 'destination', 'exclude'].includes(field))) throw refused('INVALID_INPUT', 'Unknown mapping field')
      }
    } else if (key === 'schedule') schedulePatch(value)
    else if (key === 'retention' && value !== 'standard' && value !== 'off') throw refused('INVALID_INPUT', 'retention must be standard or off')
    else if (typeof value !== 'string' || (key === 'name' && !value.trim())) throw refused('INVALID_INPUT', `Invalid ${key}`)
  }
  return values
}

export function createBackupOperations(api: ValleyPluginApi, store: ProfileStore) {
  let disposed = false
  let disposal: Promise<void> | undefined
  let pendingRun: Promise<unknown> | undefined
  const pendingChecks = new Map<Promise<unknown>, AbortController>()
  let controller: AbortController | undefined
  const root = api.getState().vault?.path ?? null
  const isActive = (): boolean => {
    if (disposed) return false
    try { return (api.getState().vault?.path ?? null) === root } catch { return false }
  }
  const assertActive = (): void => { if (!isActive()) throw refused('BACKUP_INACTIVE', 'Backup session is no longer active') }
  const offState = api.subscribe(() => { if (!isActive()) void dispose() })
  const client = backupApi(api)
  let running = false
  let runningProfileId: string | null = null
  let latestProgress: MirrorProgress | null = null
  const offProgress = client.onProgress((progress) => { if (isActive() && running && progress.update) latestProgress = progress })
  const connectCancellation = (local: AbortController, context?: CommandContext) => {
    const cancel = (): void => local.abort()
    if (context?.cancellation?.aborted) cancel()
    else context?.cancellation?.addEventListener('abort', cancel)
    return () => context?.cancellation?.removeEventListener('abort', cancel)
  }
  const profile = (profileId?: string): Profile => {
    assertActive()
    const profiles = store.getSnapshot()
    const id = profileId ?? String(api.settings.get().activeProfileId ?? '')
    const selected = id ? profiles.find((item) => item.id === id) : profiles[0]
    if (!selected) throw refused('NOT_FOUND', `Backup profile not found: ${id || '(none configured)'}`)
    return selected
  }
  const runs = createHistoryStore(api, assertActive)
  const history = (limit = 50, cursor?: string) => { assertActive(); return runs.query(limit, cursor) }
  const removeHistory = async (id: string, record: RunRecord) => {
    assertActive()
    const { before, after } = await runs.remove(id, record)
    const restore = (expected: RunRecord[], next: RunRecord[]) => async () => { assertActive(); await runs.replace(expected, next) }
    return { value: await runs.query(500), revert: { label: 'Restore backup history entry', run: restore(after, before), reapply: restore(before, after) } }
  }
  const check = (profileId?: string, context?: CommandContext) => {
    assertActive()
    store.assertClean()
    const plan = mirrorPlan(profile(profileId))
    const checkController = new AbortController()
    const disconnect = connectCancellation(checkController, context)
    const task: ReturnType<typeof client.check> = (async () => {
      try {
        if (checkController.signal.aborted) return { ok: false, error: 'Backup operation cancelled' }
        const acceptedClient = context?.operation ? backupApi(api.forOperation(context.operation)) : client
        return await acceptedClient.check(plan, checkController.signal)
      } finally { disconnect() }
    })()
    pendingChecks.set(task, checkController)
    void task.then(() => pendingChecks.delete(task), () => pendingChecks.delete(task))
    return task
  }
  const notifyOutcome = async (selected: Profile, data: MirrorResult | undefined, error?: string): Promise<void> => {
    const language = api.ui.language()
    if (data?.ok) {
      await api.notifications.notify('finished', {
        title: uiText('backup.notification.finished'),
        body: uiText('backup.notification.summary', { profile: selected.name, copied: data.copied ?? 0, archived: data.archived, duration: formatDuration(data.durationSec, language) }),
        sourceEventId: crypto.randomUUID(), key: `finished:${selected.id}`
      })
      return
    }
    const reason = data ? data.message ?? uiText('auto.a6df420d2c59', { p0: data.failedItems || data.errors }) : error ?? uiText('auto.beb2ea0a45a6')
    await api.notifications.notify('failed', {
      title: uiText('backup.notification.failed'),
      body: uiText('backup.notification.reason', { profile: selected.name, reason }),
      sourceEventId: crypto.randomUUID(), key: `failed:${selected.id}`
    })
  }
  const execute = async (profileId?: string, prechecked = false, context?: CommandContext, options: RunOptions = {}): ReturnType<typeof client.run> => {
    assertActive()
    store.assertClean()
    if (running) throw refused('BACKUP_RUNNING', 'A backup is already running. Check backup:status before starting another.')
    const selected = { ...profile(profileId) }
    const plan = mirrorPlan(selected)
    if (context?.cancellation?.aborted) return { ok: false, error: 'Backup operation cancelled' }
    const acceptedClient = context?.operation ? backupApi(api.forOperation(context.operation)) : client
    const trigger = options.trigger ?? (context ? 'automation' : 'manual')
    const runId = options.runId ?? crypto.randomUUID()
    running = true
    runningProfileId = selected.id
    latestProgress = null
    const runController = new AbortController()
    controller = runController
    const disconnect = connectCancellation(runController, context)
    let recorded = false
    try {
    if (runController.signal.aborted) return { ok: false, error: 'Backup operation cancelled' }
    if (!prechecked) {
      // The precheck only reads; whatever stops it, nothing has been copied yet.
      const checked = await acceptedClient.check(plan, runController.signal).catch((error: unknown) => { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { code: (error as { code?: unknown })?.code ?? 'PRECHECK_FAILED', outcome: 'not-applied' as const, outcomeUnknown: false, committed: false, retryable: false }) })
      assertActive()
      if (!checked.ok || !checked.data?.ok) throw refused('PRECHECK_FAILED', checked.error ?? checked.data?.issues.map((issue) => issue.message).join('; ') ?? 'Backup precheck failed')
    }
    if (runController.signal.aborted) return { ok: false, error: 'Backup operation cancelled' }
    const startedAt = new Date().toISOString()
    const identity = { id: runId, startedAt, profileId: selected.id, profileName: selected.name, trigger }
    recorded = true
    const result = await acceptedClient.run(plan, runController.signal, identity)
    return result
    } catch (error) {
      if (!(error instanceof BackupClaimed) && isActive()) {
        const message = error instanceof Error ? error.message : String(error)
        if (!recorded && isActive()) await notifyOutcome(selected, undefined, message)
      }
      throw error
    } finally { disconnect(); running = false; runningProfileId = null; latestProgress = null; controller = undefined }
  }
  const run = (profileId?: string, prechecked = false, context?: CommandContext, options?: RunOptions) => {
    const task = execute(profileId, prechecked, context, options)
    if (!pendingRun) {
      pendingRun = task
      void task.then(() => { if (pendingRun === task) pendingRun = undefined }, () => { if (pendingRun === task) pendingRun = undefined })
    }
    return task
  }
  /** Stop the running backup. Work already copied or archived stays. */
  const cancel = (): boolean => {
    if (!controller || controller.signal.aborted) return false
    controller.abort()
    return true
  }
  /** Stop the running backup wherever it started: this window, another caller, a schedule or a workflow. */
  const stop = async (): Promise<boolean> => {
    if (cancel()) return true
    if (!isActive()) throw Object.assign(new Error('Backup session is no longer active'), { code: 'BACKUP_INACTIVE', outcome: 'not-applied' })
    const stopped = await client.stop()
    if (!stopped.ok) throw Object.assign(new Error(`Could not reach the backup engine: ${stopped.error}. Check backup:status and backup:history before retrying.`), { code: 'BACKUP_STOP_UNAVAILABLE', outcome: 'unknown' })
    return stopped.data === true
  }
  function dispose(): Promise<void> {
    if (disposal) return disposal
    disposed = true
    offState()
    offProgress()
    for (const checkController of pendingChecks.values()) checkController.abort()
    return disposal = Promise.allSettled([pendingRun, ...pendingChecks.keys()]).then(() => {})
  }
  const replace = async (next: Profile[], before: Profile[]) => {
    assertActive()
    store.assertClean()
    await store.save(next)
    const expected = JSON.stringify(next.map(serializeProfile))
    return {
      value: next.map(serializeProfile),
      revert: {
        label: 'Update backup profiles',
        run: async () => {
          assertActive()
          store.assertClean()
          if (JSON.stringify(store.getSnapshot().map(serializeProfile)) !== expected) throw refused('REVISION_CONFLICT', 'Backup profiles changed after this operation')
          await store.save(before)
        }
      }
    }
  }
  const update = async (profileId: string, values: Record<string, unknown>) => {
    const selected = profile(profileId)
    const current = serializeProfile(selected)
    const patch = profilePatch(values)
    if (patch.schedule) patch.schedule = { ...current.schedule, ...object(patch.schedule), since: Date.now() }
    const before = store.getSnapshot()
    const [next] = parseProfiles({ profiles: [{ ...current, ...patch }] })
    return replace(before.map((item) => item.id === selected.id ? next : item), before)
  }
  type RunStatus = { running: boolean; profileId: string | null; progress: MirrorProgress | null }
  /** The backend owns every run (this window's, another caller's, a schedule's or a workflow's); the local fields cover this window's precheck and an unreachable backend. */
  const status = async (): Promise<RunStatus> => {
    const local: RunStatus = { running, profileId: runningProfileId, progress: latestProgress }
    let remote: unknown
    try { remote = await client.status() } catch { return local }
    if (!remote || typeof remote !== 'object') return local
    const value = remote as Record<string, unknown>
    if (value.running !== true) return local
    const progress = value.progress && typeof value.progress === 'object' && !Array.isArray(value.progress) ? value.progress as MirrorProgress : null
    return { running: true, profileId: typeof value.profileId === 'string' ? value.profileId : local.profileId, progress: progress ?? (running ? local.progress : null) }
  }
  return { profile, plan: (profileId?: string, forceRetention = false) => { store.assertClean(); return mirrorPlan(profile(profileId), forceRetention) }, history, removeHistory, check, run, cancel, stop, replace, update, isActive, assertActive, status, dispose }
}

export function registerBackupCommands(api: ValleyPluginApi, store: ProfileStore, operations: ReturnType<typeof createBackupOperations>, schedules: () => unknown = () => ({})): () => Promise<void> {
  const profileRevision = ({ profileId }: ProfileTarget) => serializeProfile(operations.profile(profileId))
  const prunePreview = async ({ profileId }: ProfileTarget, context?: CommandContext) => {
    const result = await backupApi(context?.operation ? api.forOperation(context.operation) : api).prune(operations.plan(profileId, true), { dryRun: true }, context?.cancellation)
    if (!result.ok || !result.data || result.data.errors.length) throw new Error(result.error ?? result.data?.errors.map((entry) => entry.message).join('; ') ?? 'Could not inspect backup retention')
    return result.data
  }
  const restorePreview = async ({ profileId, mappingIndex }: { profileId: string; mappingIndex: number }, context?: CommandContext) => {
    const result = await backupApi(context?.operation ? api.forOperation(context.operation) : api).restorePlan(operations.plan(profileId), mappingIndex, context?.cancellation)
    if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.message ?? 'Could not inspect this restore')
    return result.data
  }
  const mappingInput = {
    schema: { ...targetSchema, properties: { ...targetSchema.properties, mappingIndex: { type: 'integer', minimum: 0 } }, required: ['mappingIndex'] },
    parse: (raw: unknown) => {
      const selected = target(raw), mappingIndex = Number(object(raw).mappingIndex)
      if (!Number.isInteger(mappingIndex) || mappingIndex < 0) throw refused('INVALID_INPUT', 'mappingIndex must be a nonnegative integer')
      const profile = operations.profile(selected.profileId)
      if (!profile.rows[mappingIndex]) throw refused('NOT_FOUND', 'Backup mapping does not exist')
      return { profileId: profile.id, mappingIndex }
    }
  }
  const off = [
    commandRegistrar(api)({ id: 'status', outputSchema: backupResults['status'], label: 'Backup progress', labelKey: 'backup.surface.status', sideEffect: 'read', paletteSafe: false, run: async () => ({ ...(await operations.status()), schedules: schedules() }) }),
    commandRegistrar(api)({ id: 'stop', outputSchema: backupResults['stop'], label: 'Stop backup', labelKey: 'backup.surface.stop', sideEffect: 'write', paletteSafe: false, run: async () => ({ value: { stopped: await operations.stop() }, revert: null }) }),
    commandRegistrar(api)({ id: 'profiles', outputSchema: backupResults['profiles'], label: 'List backup profiles', labelKey: 'backup.surface.profiles', paletteSafe: false, sideEffect: 'read', run: () => store.getSnapshot().map(serializeProfile) }),
    commandRegistrar(api)({ id: 'profile-read', outputSchema: backupResults['profile-read'], label: 'Read backup profile', labelKey: 'backup.surface.profile-read', paletteSafe: false, sideEffect: 'read', input: targetInput, run: ({ profileId }) => serializeProfile(operations.profile(profileId)) }),
    commandRegistrar(api)({ id: 'profile-create', outputSchema: backupResults['profile-create'], label: 'Create backup profile', labelKey: 'backup.surface.profile-create', paletteSafe: false, sideEffect: 'write',
      input: { schema: { type: 'object', properties: profileFields, required: ['name'], additionalProperties: false }, parse: (raw) => { const value = profilePatch(raw); if (typeof value.name !== 'string') throw refused('INVALID_INPUT', 'name is required'); return value } },
      revision: () => store.getSnapshot().map(serializeProfile), preview: (values) => ({ action: 'create-profile', values }),
      run: async (values) => {
        const before = store.getSnapshot()
        const created = values.schedule ? { ...values, schedule: { ...object(values.schedule), since: Date.now() } } : values
        const next = parseProfiles({ profiles: [{ id: genId(), ...created }] })
        return operations.replace([...before, ...next], before)
      }
    }),
    commandRegistrar(api)({ id: 'profile-update', outputSchema: backupResults['profile-update'], label: 'Update backup profile', labelKey: 'backup.surface.profile-update', paletteSafe: false, sideEffect: 'write',
      input: { schema: { type: 'object', properties: { profileId: { type: 'string' }, values: { type: 'object', properties: profileFields, additionalProperties: false } }, required: ['profileId', 'values'], additionalProperties: false }, parse: (raw) => { const selected = target(raw); if (!selected.profileId) throw refused('INVALID_INPUT', 'profileId is required'); return { profileId: selected.profileId, values: profilePatch(object(raw).values) } } },
      revision: (input) => profileRevision(input), preview: (input) => input, run: ({ profileId, values }) => operations.update(profileId, values)
    }),
    commandRegistrar(api)({ id: 'profile-delete', outputSchema: backupResults['profile-delete'], label: 'Delete backup profile', labelKey: 'backup.surface.profile-delete', paletteSafe: false, sideEffect: 'write', input: targetInput,
      revision: profileRevision, preview: ({ profileId }) => ({ action: 'delete-profile', profile: serializeProfile(operations.profile(profileId)) }),
      run: async ({ profileId }) => { const selected = operations.profile(profileId); const before = store.getSnapshot(); return operations.replace(before.filter((item) => item.id !== selected.id), before) }
    }),
    // The backend services in config.json own the plan-based check/run/prune IDs; the profile forms keep distinct IDs so neither shadows the other.
    commandRegistrar(api)({ id: 'profile-check', outputSchema: backupResults['check'], label: 'Check backup profile', labelKey: 'backup.surface.check', paletteSafe: false, sideEffect: 'read', input: targetInput, run: async ({ profileId }, context) => {
      const result = await operations.check(profileId, context)
      if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.issues.map((issue) => issue.message).join('; ') ?? 'Backup precheck failed')
      return result.data
    } }),
    commandRegistrar(api)({ id: 'profile-run', outputSchema: backupResults['run'], label: 'Backup now', labelKey: 'auto.5d5dba0742de', sideEffect: 'write', input: targetInput,
      revision: profileRevision, preview: ({ profileId }) => operations.check(profileId),
      run: async ({ profileId }, context) => { const result = await operations.run(profileId, false, context); if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.message ?? 'Backup failed'); return { value: result.data, revert: null } }
    }),
    commandRegistrar(api)({ id: 'history', outputSchema: backupResults['history'], label: 'Read backup history', labelKey: 'backup.surface.history', paletteSafe: false, sideEffect: 'read',
      input: { schema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 500 }, cursor: { type: 'string' } } }, parse: (raw) => { const value = object(raw), limit = Number(value.limit ?? 50); if (!Number.isInteger(limit) || limit < 1 || limit > 500 || (value.cursor !== undefined && typeof value.cursor !== 'string')) throw refused('INVALID_INPUT', 'Invalid pagination'); return { limit, cursor: value.cursor as string | undefined } } },
      run: ({ limit, cursor }) => operations.history(limit, cursor)
    }),
    commandRegistrar(api)({ id: 'history-remove', outputSchema: backupResults['history'], label: 'Remove backup history entry', labelKey: 'backup.surface.history-remove', paletteSafe: false, sideEffect: 'write',
      input: { schema: { type: 'object', properties: { id: { type: 'string', minLength: 1, maxLength: 256 }, record: { type: 'object', properties: { id: { type: 'string' }, startedAt: { type: 'string' } }, required: ['id', 'startedAt'], maxProperties: 1000, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } } }, required: ['id', 'record'], additionalProperties: false },
        parse: (raw) => {
          const value = object(raw), record = object(value.record)
          if (typeof value.id !== 'string' || !value.id || value.id.length > 256 || record.id !== value.id || typeof record.startedAt !== 'string' || Object.values(record).some((entry) => entry !== null && !['string', 'number', 'boolean'].includes(typeof entry))) throw refused('INVALID_INPUT', 'id and its exact history record are required')
          return { id: value.id, record: record as RunRecord }
        } },
      revision: async ({ id }) => (await operations.history(500)).rows.find((row) => row.id === id) ?? null, preview: (input) => ({ action: 'remove-history', ...input }),
      run: ({ id, record }) => operations.removeHistory(id, record)
    }),
    commandRegistrar(api)({ id: 'prune-preview', outputSchema: backupResults['prune-preview'], label: 'Preview backup retention', labelKey: 'backup.surface.prune-preview', paletteSafe: false, sideEffect: 'read', input: targetInput, run: prunePreview }),
    commandRegistrar(api)({ id: 'profile-prune', outputSchema: backupResults['prune'], label: 'Apply backup retention', labelKey: 'backup.surface.prune', paletteSafe: false, sideEffect: 'write', input: targetInput,
      revision: async (input) => ({ profile: profileRevision(input), plan: await prunePreview(input) }), preview: prunePreview,
      run: async ({ profileId }, context) => { const result = await backupApi(context.operation ? api.forOperation(context.operation) : api).prune(operations.plan(profileId, true), { dryRun: false }, context.cancellation); if (!result.ok || result.data?.errors.length) throw new Error(result.error ?? `Retention did not finish. ${result.data?.dropped.length ?? 0} archives were removed; inspect history before retrying.`); return { value: result.data, revert: null } }
    }),
    commandRegistrar(api)({ id: 'restore-preview', outputSchema: backupResults['restore-preview'], label: 'Preview backup restore', labelKey: 'backup.surface.restore-preview', paletteSafe: false, sideEffect: 'read', input: mappingInput, run: restorePreview }),
    commandRegistrar(api)({ id: 'restore', outputSchema: backupResults['restore'], label: 'Restore backup mapping', labelKey: 'backup.surface.restore', paletteSafe: false, sideEffect: 'write', input: mappingInput,
      revision: async (input) => ({ profile: profileRevision(input), plan: await restorePreview(input) }), preview: restorePreview,
      run: async ({ profileId, mappingIndex }, context) => { const result = await backupApi(context.operation ? api.forOperation(context.operation) : api).restoreApply(operations.plan(profileId), mappingIndex, context.cancellation); if (!result.ok || !result.data?.ok) throw new Error(result.error ?? result.data?.message ?? 'Restore failed'); return { value: result.data, revert: null } }
    })
  ]
  return () => { for (const dispose of off) dispose(); return operations.dispose() }
}
