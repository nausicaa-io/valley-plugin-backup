import { subscribeHistory } from './history'
import type { ValleyPluginApi } from '@valley/plugin-sdk'
import { backupApi } from './backupApi'
import { BackupClaimed, type createBackupOperations, type RunOptions, type RunTrigger } from './commands'
import { mirrorPlan, str } from './profiles'
import { uiText } from './localization'
import { formatDuration } from './format'
import type { MirrorIssue, MirrorMappingResult, MirrorProgressUpdate } from './types'

export interface HistoryRecord {
  id: string
  startedAt: string
  profileId?: string
  profileName: string
  trigger?: RunTrigger
  durationSec: number
  archived: number
  copied: number
  errors: number
  failedItems: number
  ok: boolean
  reason?: string
}

interface PanelState {
  status: 'idle' | 'running' | 'done' | 'failed' | 'stopped'
  summary: string
  lines: string[]
  progress: MirrorProgressUpdate | null
  mappingResults: MirrorMappingResult[]
  issues: MirrorIssue[]
  /** Ticked folders found missing just before the last manual run. */
  missingFolders: string[]
  history: HistoryRecord[]
  historyError: string | null
  estimateSec: number | null
  startedAt: number
  /** The profile a stopped run can resume for. */
  resumeProfileId: string | null
}

const number = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0

export function createBackupPanelState(api: ValleyPluginApi, operations: Pick<ReturnType<typeof createBackupOperations>, 'isActive' | 'missingFolders' | 'check' | 'run' | 'stop' | 'profile' | 'history'>) {
  let snapshot: PanelState = { status: 'idle', summary: '', lines: [], progress: null, mappingResults: [], issues: [], missingFolders: [], history: [], historyError: null, estimateSec: null, startedAt: 0, resumeProfileId: null }
  let disposed = false
  let disposal: Promise<void> | undefined
  let historyRun: Promise<void> | undefined
  let historyDirty = false
  let generation = 0
  let run: Promise<void> | undefined
  const listeners = new Set<() => void>()
  const active = (): boolean => !disposed && operations.isActive()
  const publish = (patch: Partial<PanelState>): void => {
    if (!active()) return
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }
  const loadHistory = (): Promise<void> => {
    if (!active()) return Promise.resolve()
    generation++
    historyDirty = true
    if (historyRun) return historyRun
    historyRun = (async () => {
      while (active() && historyDirty) {
        historyDirty = false
        const accepted = generation
        try {
          const page = await operations.history(50)
          if (!active()) return
          if (accepted !== generation) { historyDirty = true; continue }
          const history = page.rows.map((row): HistoryRecord => ({
            id: str(row.id), startedAt: str(row.startedAt), profileName: str(row.profileName) || 'Backup',
            ...(row.profileId ? { profileId: str(row.profileId) } : {}),
            ...(row.trigger === 'manual' || row.trigger === 'scheduled' || row.trigger === 'automation' ? { trigger: row.trigger } : {}),
            durationSec: number(row.durationSec), archived: number(row.archived), copied: number(row.copied),
            errors: number(row.errors), failedItems: number(row.failedItems),
            ok: row.ok === true || row.ok === 'true', reason: row.reason ? str(row.reason) : undefined
          })).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, 50)
          publish({ history, historyError: null })
        } catch {
          if (accepted !== generation) { historyDirty = true; continue }
          publish({ historyError: uiText('backup.history.failed') })
        }
      }
    })().finally(() => { historyRun = undefined })
    return historyRun
  }
  const offHistory = subscribeHistory(api, () => { void loadHistory() })
  const offProgress = backupApi(api).onProgress(value => {
    if (value.update) publish({ progress: value.update })
    else if (value.mapping) publish({ mappingResults: [...snapshot.mappingResults.filter(item => item.source !== value.mapping!.source || item.destination !== value.mapping!.destination), value.mapping].sort((a, b) => a.index - b.index) })
    else if (value.lines?.length) publish({ lines: [...snapshot.lines, ...value.lines].slice(-800) })
  })
  let stopping = false
  /** A run that ends without its final per-folder events leaves no folder spinning. */
  const settleRunning = (status: 'stopped' | 'failed'): MirrorMappingResult[] =>
    snapshot.mappingResults.map(item => item.status === 'running' ? { ...item, status } : item)
  /** Preflight, then run with live progress. A scheduled run passes its trigger
   *  and slot id; a slot another window already claimed leaves the panel idle. */
  const start = (profileId: string, { resume = false, ...options }: RunOptions & { resume?: boolean } = {}): Promise<void> => {
    if (!active()) return Promise.resolve()
    if (run) return run
    run = (async () => {
      const previous = { status: snapshot.status, summary: snapshot.summary }
      // A resume that cannot go on yet (a drive went away) stays resumable.
      const blocked = resume ? 'stopped' as const : 'failed' as const
      try {
        publish({ issues: [], missingFolders: [] })
        // A scheduled run keeps waiting for its drive; a manual one runs whatever is there now.
        const manual = !options.trigger || options.trigger === 'manual'
        const skipFolders = manual ? await operations.missingFolders(profileId || undefined) : []
        if (!active()) return
        publish({ missingFolders: skipFolders })
        const mappings = mirrorPlan(operations.profile(profileId || undefined)).mappings
        const finished = resume ? snapshot.mappingResults.filter(item => item.status === 'done') : []
        const finishedDestinations = finished.map(item => item.destination)
        const left = mappings.filter(mapping => !finishedDestinations.includes(mapping.destination))
        // Stopped after the last folder finished: nothing is left to continue, so every folder runs again.
        const doneDestinations = left.length ? finishedDestinations : []
        const pending = left.length ? left : mappings
        if (skipFolders.length && pending.every((mapping) => skipFolders.includes(mapping.source) || skipFolders.includes(mapping.destination))) {
          publish({ status: blocked, summary: uiText('backup.folder.allMissing') })
          return
        }
        const preflight = await operations.check(profileId || undefined, undefined, skipFolders, doneDestinations)
        if (!active()) return
        if (!preflight.ok || !preflight.data?.ok) {
          publish({ status: blocked, summary: resume ? previous.summary : '', issues: preflight.data?.issues ?? [{ kind: 'dest-error', message: uiText('auto.e97ecd4af356') }] })
          return
        }
        const selected = operations.profile(profileId || undefined)
        const prior = snapshot.history.find(item => item.ok && (item.profileId === selected.id || item.profileName === selected.name)) ?? snapshot.history.find(item => item.ok)
        publish({ status: 'running', summary: '', lines: resume ? snapshot.lines : [], progress: null, mappingResults: resume ? finished : [], estimateSec: resume ? null : prior?.durationSec ?? null, startedAt: Date.now(), resumeProfileId: null })
        const invoked = await operations.run(profileId || undefined, true, undefined, manual ? { ...options, skipFolders, doneDestinations } : options)
        if (!active()) return
        const result = invoked.data
        if (result?.cancelled || (!result && stopping)) {
          publish({ status: 'stopped', resumeProfileId: selected.id, progress: null, mappingResults: settleRunning('stopped'), summary: uiText('backup.status.stopped', { copied: result?.copied ?? 0, archived: result?.archived ?? 0 }) })
        } else if (!invoked.ok || !result) {
          publish({ status: 'failed', progress: null, mappingResults: settleRunning('failed'), summary: uiText('auto.beb2ea0a45a6') })
        } else {
          const language = api.ui.language()
          publish({
            status: result.ok ? 'done' : 'failed', progress: null,
            ...(result.issues?.length ? { issues: result.issues } : {}),
            summary: result.ok
              ? uiText('backup.status.done', { copied: result.copied ?? 0, archived: result.archived, duration: formatDuration(result.durationSec, language) })
              : result.message ?? uiText('auto.a6df420d2c59', { p0: result.failedItems || result.errors })
          })
        }
        await loadHistory()
      } catch (error) {
        if (error instanceof BackupClaimed) { publish({ ...previous, progress: null }); return }
        publish({ status: 'failed', progress: null, mappingResults: settleRunning('failed'), summary: uiText('auto.beb2ea0a45a6') })
      } finally { stopping = false }
    })().finally(() => { run = undefined })
    return run
  }
  const stop = (): void => {
    if (!run || stopping) return
    stopping = true
    void operations.stop().catch(() => { stopping = false })
  }
  /** Forget a stopped run: the panel is back at Backup now. Copied and archived files stay. */
  const discardStopped = (): void => {
    if (run || snapshot.status !== 'stopped') return
    publish({ status: 'idle', summary: '', progress: null, mappingResults: [], issues: [], missingFolders: [], resumeProfileId: null })
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (!active()) return () => {}
      const first = !listeners.size
      listeners.add(listener)
      if (first) void loadHistory()
      return () => { listeners.delete(listener) }
    },
    clearIssues: () => publish({ issues: [], missingFolders: [] }),
    loadHistory,
    start,
    stop,
    discardStopped,
    isRunning: (): boolean => !!run,
    dispose(): Promise<void> {
      if (disposal) return disposal
      disposed = true
      generation++
      offHistory(); offProgress(); listeners.clear()
      return disposal = Promise.allSettled([historyRun, run]).then(() => {})
    }
  }
}
