import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { MirrorPlan, MirrorPreflight, MirrorProgress, MirrorResult } from './types'
import type { PruneResult, RestoreOutcome } from './backend/mirrorService'

type Result<T> = { ok: true; data: T; error?: undefined } | { ok: false; error: string; data?: undefined }
export function backupApi(api: ValleyPluginApi) {
  const call = async <T>(method: string, payload: unknown): Promise<Result<T>> => {
    try { return { ok: true, data: await api.backend.call<T>(method, payload) } }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) } }
  }
  return {
    check: (plan: MirrorPlan) => call<MirrorPreflight>('check', { plan }),
    run: (plan: MirrorPlan) => call<MirrorResult>('run', { plan }),
    prune: (plan: MirrorPlan, options?: { dryRun?: boolean }) => call<PruneResult>('prune', { plan, ...options }),
    restorePlan: (plan: MirrorPlan, mappingIndex: number) => call<RestoreOutcome & { escrowDir?: string }>('restorePlan', { plan, mappingIndex }),
    restoreApply: (plan: MirrorPlan, mappingIndex: number) => call<RestoreOutcome & { escrowDir?: string }>('restoreApply', { plan, mappingIndex }),
    reveal: (plan: MirrorPlan, path: string) => call<boolean>('reveal', { plan, path }),
    onProgress: (listener: (progress: MirrorProgress) => void) => api.backend.on('progress', (value) => listener(value as MirrorProgress))
  }
}
