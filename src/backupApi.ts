import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { MirrorPlan, MirrorPreflight, MirrorProgress, MirrorResult } from './types'
import type { PruneResult, RestoreOutcome } from './backend/mirrorService'

type Result<T> = { ok: true; data: T; error?: undefined } | { ok: false; error: string; data?: undefined }
export function backupApi(api: ValleyPluginApi) {
  const call = async <T>(method: string, payload: unknown): Promise<Result<T>> => {
    try { return { ok: true, data: await api.backend.call<T>(method, payload) } }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
  }
  const operation = async <T>(method: string, plan: MirrorPlan, payload: Record<string, unknown>, signal?: AbortSignal): Promise<Result<T>> => {
    const admitted = { ...plan, mappings: plan.mappings.map((mapping) => ({ ...mapping, exclude: [...mapping.exclude] })), retention: plan.retention ? { ...plan.retention } : null }
    try {
      return { ok: true, data: await api.backend.callOperation<T>(method, { plan: admitted, ...payload }, signal ? { cancellation: signal } : undefined) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
  return {
    check: (plan: MirrorPlan, signal?: AbortSignal) => operation<MirrorPreflight>('check', plan, {}, signal),
    run: (plan: MirrorPlan, signal?: AbortSignal, identity?: { id: string; startedAt: string; profileId: string; profileName: string; trigger: string }) => operation<MirrorResult>('run', plan, { identity }, signal),
    prune: (plan: MirrorPlan, options?: { dryRun?: boolean }, signal?: AbortSignal) => operation<PruneResult>('prune', plan, { ...options }, signal),
    restorePlan: (plan: MirrorPlan, mappingIndex: number, signal?: AbortSignal) => operation<RestoreOutcome & { escrowDir?: string }>('restorePlan', plan, { mappingIndex }, signal),
    restoreApply: (plan: MirrorPlan, mappingIndex: number, signal?: AbortSignal) => operation<RestoreOutcome & { escrowDir?: string }>('restoreApply', plan, { mappingIndex }, signal),
    reveal: (plan: MirrorPlan, path: string) => call<boolean>('reveal', { plan, path }),
    stop: () => call<boolean>('stop', {}),
    status: async () => { const result = await call<unknown>('run.status', {}); if (!result.ok) throw new Error(result.error); return result.data },
    onProgress: (listener: (progress: MirrorProgress) => void) => api.backend.on('progress', (value) => listener(value as MirrorProgress))
  }
}
