import { initBackendLocalization, t } from './localization'
import type { PluginBackendApi } from '@valley/plugin-sdk'
import { z } from 'zod'
import { checkMirror, mirrorTimestamp, pruneMirrorArchives, runMirror, runRestore } from './mirrorService'
import { isAbsolute, join } from './path'
import { authorizePlan, bindStorage, releaseStorage, revealStorage } from './storageFs'

const absolute = z.string().max(4096).refine(isAbsolute, () => ({ message: t('backend.absolute') }))
const optionalPath = z.union([absolute, z.literal('')])
const planSchema = z.object({
  label: z.string().max(256), mappings: z.array(z.object({ source: absolute, destination: absolute, exclude: z.array(z.string().max(1024)).max(256) }).strict()).max(100),
  trashPath: optionalPath, logDirectory: optionalPath, masterLog: optionalPath,
  retention: z.object({ keepDays: z.number().int().nonnegative(), dailies: z.number().int().nonnegative(), weeklies: z.number().int().nonnegative() }).strict().nullable()
}).strict()
const input = z.object({ plan: planSchema }).strict()

export function register(api: PluginBackendApi): () => void {
  const offLocalization = initBackendLocalization(api.i18n)
  bindStorage(api.storage)
  let busy = false
  const subscriptions: Array<() => void> = []
  const register = (method: string, operation: (raw: unknown) => Promise<unknown>) => subscriptions.push(api.rpc.handle(method, async (raw) => {
    if (busy && !['check', 'reveal'].includes(method)) throw new Error(t('backend.busy'))
    const exclusive = !['check', 'reveal'].includes(method)
    if (exclusive) busy = true
    try { return await operation(raw) } finally { if (exclusive) busy = false }
  }))
  register('check', async (raw) => { const { plan } = input.parse(raw); await authorizePlan(plan, 'check'); return checkMirror(plan) })
  register('run', async (raw) => {
    const { plan } = input.parse(raw)
    await authorizePlan(plan, 'run')
    return runMirror('', plan, (line) => api.rpc.emit('progress', { line }), (update) => api.rpc.emit('progress', { update }), (mapping) => api.rpc.emit('progress', { mapping }))
  })
  register('prune', async (raw) => {
    const { plan, dryRun } = input.extend({ dryRun: z.boolean().optional() }).parse(raw)
    await authorizePlan(plan, dryRun ? 'check' : 'prune')
    return pruneMirrorArchives(plan, { dryRun })
  })
  for (const method of ['restorePlan', 'restoreApply'] as const) register(method, async (raw) => {
    const { plan, mappingIndex } = input.extend({ mappingIndex: z.number().int().nonnegative() }).parse(raw)
    const mapping = plan.mappings[mappingIndex]
    if (!mapping) throw new Error(t('backend.mapping'))
    await authorizePlan(plan, method)
    const escrowDir = join(plan.trashPath || join(mapping.destination, '.trash'), `restore-${mirrorTimestamp()}`)
    const result = await runRestore(mapping, { dryRun: method === 'restorePlan', ...(method === 'restoreApply' ? { escrowDir } : {}) }, (line) => api.rpc.emit('progress', { line }))
    return method === 'restoreApply' ? { ...result, escrowDir } : result
  })
  register('reveal', async (raw) => { const { plan, path } = input.extend({ path: absolute }).parse(raw); await authorizePlan(plan, 'reveal'); await revealStorage(path); return true })
  return () => { offLocalization(); subscriptions.forEach((dispose) => dispose()); void releaseStorage() }
}
