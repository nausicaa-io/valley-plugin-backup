import { createWorkflowAdapter } from './workflow'
import { initBackendLocalization, t } from './localization'
import type { PluginBackendApi, PluginBackendOperationContext } from '@valley/plugin-sdk'
import { z } from 'zod'
import { ARCHIVE_DIR, createMirrorService, mirrorTimestamp, planMapping } from './mirrorService'
import { isAbsolute, join } from './path'
import { createStorageSession, type StorageSession } from './storageFs'
import { MirrorJobs } from './jobLifetime'
import { BackupClaimed, createHistoryStore } from '../history'
import type { MirrorResult } from '../types'
import { formatDuration } from '../format'
import { parseProfiles, mirrorPlan } from '../profiles'
import { isDue, nextRunAt, nextSlot, runFacts, slotStart } from '../schedule'
import type { MirrorPreflight } from '../types'

const absolute = z.string().max(4096).refine(isAbsolute, () => ({ message: t('backend.absolute') }))
const optionalPath = z.union([absolute, z.literal('')])
const planSchema = z.object({
  label: z.string().max(256), mappings: z.array(z.object({ source: absolute, destination: absolute, exclude: z.array(z.string().max(1024)).max(256) }).strict()).max(100),
  trashPath: optionalPath, logDirectory: optionalPath, masterLog: optionalPath,
  retention: z.object({ keepDays: z.number().int().nonnegative(), dailies: z.number().int().nonnegative(), weeklies: z.number().int().nonnegative() }).strict().nullable()
}).strict()
const input = z.object({ plan: planSchema }).strict()
const identitySchema = z.object({ id: z.string().min(1).max(256), startedAt: z.string().datetime(), profileId: z.string().min(1).max(256), profileName: z.string().max(256), trigger: z.enum(['manual', 'scheduled', 'automation']) }).strict()
const runInput = input.extend({ identity: identitySchema, quiet: z.boolean().optional() })
/** A payload the schema refuses is rejected before any grant, write or history row: a known no-effect outcome. */
function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw Object.assign(parsed.error, { code: 'BACKUP_INVALID_INPUT', outcome: 'not-applied', fatal: true, transient: false, retryable: false })
  return parsed.data
}

/** Log lines leave the sandbox in batches: one event per copied file would
 *  flood the channel on a large tree. */
function streamLines(signal: AbortSignal, ownedApi: PluginBackendOperationContext['api']) {
  let pending: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = (): void => {
    if (timer) { clearTimeout(timer); timer = undefined }
    if (!pending.length) return
    const lines = pending
    pending = []
    if (!signal.aborted) ownedApi.rpc.emit('progress', { lines })
  }
  return {
    push: (line: string): void => {
      pending.push(line)
      if (pending.length >= 200) flush()
      else timer ??= setTimeout(flush, 150)
    },
    flush
  }
}

export function register(api: PluginBackendApi): () => Promise<void> {
  const workflow = createWorkflowAdapter(api, { readiness: (nodeId, context) => nodeId === 'profile.list' || parseProfiles((context?.api ?? api).settings.get()).some(profile => profile.rows.some(row => row.source && row.destination)) ? { state: 'Available' } : { state: 'Unconfigured', reason: 'Configure a saved source/destination profile in Backup settings.' } })
  const offLocalization = initBackendLocalization(api.i18n)
  const jobs = new MirrorJobs()
  let busy = false
  let activeRun: AbortController | undefined
  /** The run in flight, whoever started it: this backend owns the truth backup:status reports. */
  let runStatus: { profileId: string | null; progress: { update: unknown } | null } | undefined
  let disposal: Promise<void> | undefined
  const dispatched = new WeakSet<PluginBackendOperationContext>()
  const subscriptions: Array<() => void> = []
  type OperationApi = PluginBackendOperationContext['api']
  const register = (method: string, operation: (raw: unknown, storage: StorageSession, signal: AbortSignal, ownedApi: OperationApi) => Promise<unknown>) => {
    const execute = async (payload: unknown, ownedApi: OperationApi, cancellation?: AbortSignal): Promise<unknown> => {
      if (busy && !['check', 'reveal'].includes(method)) throw new Error(t('backend.busy'))
      const exclusive = !['check', 'reveal'].includes(method)
      if (exclusive) busy = true
      const stopper = method === 'run' ? new AbortController() : undefined
      const forward = (): void => stopper?.abort()
      if (stopper) {
        if (cancellation?.aborted) stopper.abort()
        else cancellation?.addEventListener('abort', forward, { once: true })
        activeRun = stopper
        const parsed = runInput.safeParse(payload)
        runStatus = parsed.success ? { profileId: parsed.data.identity.profileId, progress: null } : undefined
      }
      try {
        return await jobs.run(stopper?.signal ?? cancellation, async (signal) => {
          const storage = createStorageSession(ownedApi.storage, signal)
          let value: unknown
          let failure: unknown
          try { value = await operation(payload, storage, signal, ownedApi) }
          catch (error) { failure = error }
          try { await storage.dispose() } catch (error) { failure ??= error }
          if (failure instanceof BackupClaimed) throw failure
          if (failure) {
            const message = failure instanceof Error ? failure.message : String(failure)
            if (value && typeof value === 'object') {
              const result = value as Record<string, unknown>
              if (method === 'prune') value = { ...result, errors: [...(result.errors as unknown[]), { dir: '', message }] }
              else if (method === 'check') value = { ...result, ok: false, issues: [...(result.issues as unknown[]), { kind: 'dest-error', message }] }
              else value = { ...result, ok: false, message }
            } else if (method === 'run' && runInput.safeParse(payload).success) {
              value = { ok: false, cancelled: signal.aborted, mappings: 0, archived: 0, copied: 0, durationSec: 0, errors: 1, message } satisfies MirrorResult
            } else throw failure
          }
          if (method === 'run') {
            const { identity, quiet } = runInput.parse(payload)
            const result = value as MirrorResult
            const history = createHistoryStore(ownedApi)
            if (failure && !(await history.query(200)).rows.some(row => row.id === identity.id)) throw failure
            await history.update(identity.id, { durationSec: result.durationSec, archived: result.archived, copied: result.copied ?? 0, errors: result.errors, failedItems: result.failedItems ?? 0, ok: result.ok, reason: result.ok ? null : result.cancelled ? 'stopped' : result.message ?? null })
            await history.prune(200)
            if (!result.cancelled && !quiet) await ownedApi.notifications.notify(result.ok ? 'finished' : 'failed', {
              sourceEventId: identity.id, targetItemId: identity.profileId, key: `run:${identity.id}`,
              title: t(result.ok ? 'backup.notification.finished' : 'backup.notification.failed'),
              body: result.ok ? t('backup.notification.summary', { profile: identity.profileName, copied: result.copied ?? 0, archived: result.archived, duration: formatDuration(result.durationSec, 'en') }) : t('backup.notification.reason', { profile: identity.profileName, reason: result.message ?? t('backend.failed') }),
              actions: [{ id: 'open', kind: 'open', label: t('notification.open') }]
            }).catch(() => false)
          }
          if (failure && signal.aborted) throw failure
          return value
        })
      } finally {
        if (stopper) {
          cancellation?.removeEventListener('abort', forward)
          if (activeRun === stopper) { activeRun = undefined; runStatus = undefined }
        }
        if (exclusive) busy = false
      }
    }
    subscriptions.push(method === 'reveal' ? api.rpc.handle(method, raw => execute(raw, api)) : workflow.operation(method, (raw, context) => {
      if (!context || typeof context.id !== 'string' || !context.id || context.id.length > 128
        || typeof context.cancellation?.aborted !== 'boolean' || typeof context.cancellation.addEventListener !== 'function' || typeof context.cancellation.removeEventListener !== 'function'
        || context.api?.pluginId !== api.pluginId || typeof context.api?.storage?.open !== 'function' || typeof context.api.storage.close !== 'function' || typeof context.api.rpc?.emit !== 'function') {
        throw new Error('Invalid backup operation context')
      }
      if (dispatched.has(context)) throw new Error('Backup operation already dispatched')
      dispatched.add(context)
      return execute(raw, context.api, context.cancellation)
    }))
  }
  register('check', async (raw, storage) => { const { plan } = parse(input, raw); await storage.authorizePlan(plan, 'check'); return createMirrorService(storage).checkMirror(plan) })
  register('run', async (raw, storage, signal, ownedApi) => {
    const { plan, identity } = parse(runInput, raw)
    await storage.authorizePlan(plan, 'run')
    await createHistoryStore(ownedApi).insert({ ...identity, durationSec: 0, archived: 0, copied: 0, errors: 0, failedItems: 0, ok: false, reason: 'interrupted' })
    const lines = streamLines(signal, ownedApi)
    const status = runStatus
    const emit = (progress: unknown): void => { if (!signal.aborted) ownedApi.rpc.emit('progress', progress) }
    try {
      return await createMirrorService(storage).runMirror(plan, lines.push, (update) => { lines.flush(); if (status && status === runStatus && !signal.aborted) status.progress = { update }; emit({ update }) }, (mapping) => { lines.flush(); emit({ mapping }) })
    } finally { lines.flush() }
  })
  register('prune', async (raw, storage) => {
    const { plan, dryRun } = parse(input.extend({ dryRun: z.boolean().optional() }), raw)
    await storage.authorizePlan(plan, dryRun ? 'check' : 'prune')
    return createMirrorService(storage).pruneMirrorArchives(plan, { dryRun })
  })
  for (const method of ['restorePlan', 'restoreApply'] as const) register(method, async (raw, storage, signal, ownedApi) => {
    const { plan, mappingIndex } = parse(input.extend({ mappingIndex: z.number().int().nonnegative() }), raw)
    const mapping = plan.mappings[mappingIndex]
    if (!mapping) throw Object.assign(new Error(t('backend.mapping')), { code: 'BACKUP_INVALID_INPUT', outcome: 'not-applied', fatal: true, transient: false, retryable: false })
    await storage.authorizePlan(plan, method)
    const escrowDir = join(plan.trashPath || join(mapping.destination, ARCHIVE_DIR), `restore-${mirrorTimestamp()}`)
    const lines = streamLines(signal, ownedApi)
    try {
      const result = await createMirrorService(storage).runRestore(planMapping(plan, mapping), { dryRun: method === 'restorePlan', ...(method === 'restoreApply' ? { escrowDir } : {}) }, lines.push)
      return method === 'restoreApply' ? { ...result, escrowDir } : result
    } finally { lines.flush() }
  })
  subscriptions.push(api.rpc.handle('stop', () => {
    if (!activeRun || activeRun.signal.aborted) return false
    activeRun.abort()
    return true
  }))
  subscriptions.push(api.rpc.handle('run.status', () => runStatus ? { running: true, profileId: runStatus.profileId, progress: runStatus.progress } : { running: false, profileId: null, progress: null }))
  register('reveal', async (raw, storage) => { const { plan, path } = parse(input.extend({ path: absolute }), raw); await storage.authorizePlan(plan, 'reveal'); await storage.revealStorage(path); return true })
  for (const method of ['list', 'check', 'run', 'prune', 'restorePlan', 'restoreApply'] as const) subscriptions.push(workflow.local(`workflow.profile.${method}`, async (raw, context) => {
    context.cancellation.throwIfAborted()
    const profiles = parseProfiles(context.api.settings.get())
    if (method === 'list') return { profiles: profiles.map(profile => ({ id: profile.id, name: profile.name })) }
    const value = raw as { profileId: string; mappingIndex?: number; dryRun?: boolean }
    const profile = profiles.find(entry => entry.id === value.profileId)
    if (!profile) throw Object.assign(new Error('Saved Backup profile is unavailable'), { code: 'PROVIDER_UNCONFIGURED', fatal: true, transient: false, retryable: false })
    const plan = mirrorPlan(profile)
    const input = method === 'run' ? { plan, identity: { id: context.id, startedAt: new Date().toISOString(), profileId: profile.id, profileName: profile.name, trigger: 'automation' } }
      : method === 'prune' ? { plan, dryRun: value.dryRun ?? true }
      : method === 'restorePlan' || method === 'restoreApply' ? { plan, mappingIndex: value.mappingIndex } : { plan }
    return workflow.run(method, input, context)
  }))
  let polling: Promise<void> | undefined
  let closed = false
  const statuses: Record<string, { nextAt: number | null; waiting: string | null }> = {}
  subscriptions.push(api.rpc.handle('schedule.snapshot', () => statuses))
  const poll = (): void => {
    if (closed || polling || busy) return
    polling = (async () => {
      const rows = (await createHistoryStore(api).query(200)).rows
      for (const profile of parseProfiles(api.settings.get())) {
        if (closed || busy) return
        const schedule = profile.schedule
        if (!schedule || schedule.every === 'off' || !profile.rows.some(row => row.source && row.destination)) continue
        const now = Date.now(), facts = runFacts(rows, profile.id)
        if (!isDue(schedule, facts, now)) { statuses[profile.id] = { nextAt: nextRunAt(schedule, facts, now), waiting: null }; continue }
        const slot = slotStart(schedule, now)!
        const plan = mirrorPlan(profile)
        const checked = await api.lifecycle.runBackground<MirrorPreflight>('check', { plan })
        if (closed) return
        if (!checked.ok) {
          const reason = checked.issues[0]?.message ?? t('backend.failed')
          statuses[profile.id] = { nextAt: now, waiting: reason }
          await api.notifications.notify('waiting', { sourceEventId: `${profile.id}:${slot}`, key: `waiting:${profile.id}`, targetItemId: profile.id, title: t('backup.notification.waiting'), body: t('backup.notification.reason', { profile: profile.name, reason }), actions: [{ id: 'open', kind: 'open', label: t('notification.open') }] })
          continue
        }
        statuses[profile.id] = { nextAt: nextSlot(schedule, now), waiting: null }
        api.rpc.emit('backup.schedule', statuses)
        await api.lifecycle.runBackground('run', { plan, identity: { id: `scheduled:${profile.id}:${slot}`, startedAt: new Date().toISOString(), profileId: profile.id, profileName: profile.name, trigger: 'scheduled' } })
      }
      api.rpc.emit('backup.schedule', statuses)
    })().catch(() => {}).finally(() => { polling = undefined })
  }
  // Only a saved schedule needs the minute check; a backend without one stays asleep.
  let interval: ReturnType<typeof setInterval> | undefined
  const syncInterval = (): void => {
    const scheduled = parseProfiles(api.settings.get()).some(profile => profile.schedule && profile.schedule.every !== 'off' && profile.rows.some(row => row.source && row.destination))
    if (scheduled && interval === undefined) interval = setInterval(poll, 60000)
    else if (!scheduled && interval !== undefined) { clearInterval(interval); interval = undefined }
  }
  syncInterval()
  subscriptions.push(api.lifecycle.onResume(poll), api.settings.subscribe(() => { syncInterval(); poll() }))
  poll()
  return () => {
    if (disposal) return disposal
    closed = true
    workflow.dispose()
    if (interval !== undefined) clearInterval(interval)
    const failures: unknown[] = []
    for (const unsubscribe of subscriptions) { try { unsubscribe() } catch (error) { failures.push(error) } }
    return disposal = jobs.dispose().then(() => {
      offLocalization()
      if (failures.length) throw failures[0]
    })
  }
}
