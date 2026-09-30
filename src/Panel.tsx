import type { ValleyPluginApi, UiMenuItem } from '@valley/plugin-sdk'
import { backupApi } from './backupApi'
import type { createBackupOperations } from './commands'
import type { createMaintenanceRegistry, MaintenancePreview } from './maintenance'
import type { BackupIcons } from './icons'
import type { MirrorMappingResult } from './types'
import type { createBackupPanelState, HistoryRecord } from './panelState'
import type { createBackupScheduler } from './scheduler'
import { parseProfiles, str } from './profiles'
import { uiText } from './localization'
import { RUN_INTERRUPTED, RUN_STOPPED } from './commands'
import { formatBytes, formatCount, formatDuration, formatUpcoming } from './format'

export type BackupView = { profileId: string; tab: 'status' | 'details' | 'recent' | 'archives' }
type Tab = BackupView['tab']

/**
 * Render a date with the user's General → Date format pattern (`dd-mm-yyyy`,
 * `yyyy-mm-dd`, …) exactly like the core `fmtDate` does — the preference reaches
 * the plugin as `api.getState().dateFormat`.
 */
function formatDatePattern(t: number, pattern: string): string {
  const d = new Date(t)
  return pattern
    .replace('yyyy', String(d.getFullYear()))
    .replace(/m{2}/i, String(d.getMonth() + 1).padStart(2, '0'))
    .replace('dd', String(d.getDate()).padStart(2, '0'))
}

/** ISO timestamp → "just now" / "5 min ago" / "yesterday" / a formatted date. */
function formatRelative(iso: string, locale: string, dateFormat: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return relative.format(0, 'second')
  const min = Math.round(sec / 60)
  if (min < 60) return relative.format(-min, 'minute')
  const hr = Math.round(min / 60)
  if (hr < 24) return relative.format(-hr, 'hour')
  const day = Math.round(hr / 24)
  if (day < 7) return relative.format(-day, 'day')
  return dateFormat ? formatDatePattern(t, dateFormat) : new Date(t).toLocaleDateString(locale)
}

export function createBackupPanel(api: ValleyPluginApi, operations: ReturnType<typeof createBackupOperations>, previews: ReturnType<typeof createMaintenanceRegistry>, view: { getSnapshot(): BackupView; subscribe(listener: () => void): () => void; update(patch: Partial<BackupView>): void }, icons: BackupIcons, state: ReturnType<typeof createBackupPanelState>, scheduler: Pick<ReturnType<typeof createBackupScheduler>, 'getSnapshot' | 'subscribe'>) {
  const React = api.React
  const h = React.createElement
  const { IconCheck, IconX, IconBan, IconLoader, IconChevronDown, IconHardDrive, IconList, IconHistory, IconArchive, IconSliders, IconAlert } = icons
  const STATUS_ICON: Record<MirrorMappingResult['status'], ReturnType<typeof h>> = { running: IconLoader, done: IconCheck, skipped: IconBan, failed: IconX, stopped: IconBan }
  const BackupPanel = (): ReturnType<typeof h> => {
    const { status, summary, lines, progress, mappingResults, issues, history, historyError, estimateSec, startedAt } = React.useSyncExternalStore(state.subscribe, state.getSnapshot)
    const schedules = React.useSyncExternalStore(scheduler.subscribe, scheduler.getSnapshot)
    const [profiles, setProfiles] = React.useState<Array<{ id: string; name: string }>>([])
    const viewState = React.useSyncExternalStore(view.subscribe, view.getSnapshot)
    const selectedId = viewState.profileId
    const setSelectedId = (next: string | ((previous: string) => string)): void => view.update({ profileId: typeof next === 'function' ? next(view.getSnapshot().profileId) : next })
    const tab = viewState.tab
    const setTab = (next: Tab): void => view.update({ tab: next })
    const [dateFormat, setDateFormat] = React.useState(() => api.getState().dateFormat)
    const [timeFormat, setTimeFormat] = React.useState(() => api.getState().timeFormat)
    React.useEffect(() => api.subscribeState(['dateFormat', 'timeFormat'], () => {
      setDateFormat(api.getState().dateFormat)
      setTimeFormat(api.getState().timeFormat)
    }), [])
    const language = api.ui.language()
    const [, bumpTick] = React.useState(0)
    const maxOverallRef = React.useRef(0)
    const logRef = React.useRef<HTMLPreElement | null>(null)

    const nameFor = (id: string): string => profiles.find((p) => p.id === id)?.name ?? 'Backup'

    // Re-read profiles + active selection from plugin settings. Called on mount
    // and right before the dropdown opens, so edits made in Settings show up
    // without remounting the panel. Returns the fresh list because the menu is
    // built synchronously — it cannot wait for the state update to land.
    const refreshProfiles = React.useCallback((): Array<{ id: string; name: string }> => {
      const s = api.settings.get() as Record<string, unknown>
      const list = parseProfiles(s).map((p) => ({ id: p.id, name: p.name }))
      setProfiles(list)
      const active = str(s.activeProfileId).trim()
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev
        if (active && list.some((p) => p.id === active)) return active
        return list[0]?.id ?? ''
      })
      return list
    }, [])

    React.useEffect(() => {
      refreshProfiles()
      // Settings edits (profiles added/renamed) dispatch this — keep the dropdown
      // and selection in sync without a reload.
      const onSettings = (): void => {
        refreshProfiles()
      }
      return api.settings.subscribe(onSettings)
    }, [refreshProfiles])

    // Keep the log pinned to the newest line.
    React.useEffect(() => {
      const el = logRef.current
      if (el) el.scrollTop = el.scrollHeight
    }, [lines, tab])

    // While running, re-render once a second so the elapsed-based "time left"
    // ticks down steadily even between mirror progress events.
    React.useEffect(() => {
      if (status !== 'running') return
      const t = setInterval(() => bumpTick((n) => n + 1), 1000)
      return () => clearInterval(t)
    }, [status])

    const selectProfile = (id: string): void => {
      setSelectedId(id)
      void api.settings.set('activeProfileId', id)
      state.clearIssues()
    }

    const openSettings = (): void => api.workspace.openOwnSettings()

    // The profile picker: the host's shared menu presenter, so it renders as the
    // in-app menu or the native OS menu per Appearance → Action menus.
    const openProfileMenu = (anchor: HTMLElement): void => {
      const list = refreshProfiles()
      if (!list.length) {
        openSettings()
        return
      }
      const items: UiMenuItem[] = list.map((p) => ({
        id: p.id,
        type: 'radio',
        checked: p.id === selectedId,
        label: p.name,
        onSelect: () => selectProfile(p.id)
      }))
      items.push({ type: 'separator' }, { id: 'manage', label: uiText('auto.a94ac9e3ecd0'), onSelect: openSettings })
      void api.ui.openMenu(items, { anchor, align: 'end' })
    }

    const startRun = (): Promise<void> => state.start(selectedId)
    React.useEffect(() => { maxOverallRef.current = 0 }, [startedAt])

    // ---- Archive maintenance: retention cleanup + restore preview/apply ----
    const [maint, setMaint] = React.useState<
      | { kind: 'idle' }
      | { kind: 'busy'; label: string }
      | { kind: 'prune-counted'; preview: MaintenancePreview; drop: number; kept: number }
      | { kind: 'restore-plan'; preview: MaintenancePreview; creates: number; updates: number; deletes: number; skipped: string[] }
      | { kind: 'note'; text: string; skipped?: string[] }
    >({ kind: 'idle' })
    const maintenance = React.useRef<ReturnType<typeof previews.createOwner> | null>(null)
    React.useEffect(() => {
      const owner = previews.createOwner(() => setMaint({ kind: 'idle' }))
      maintenance.current = owner
      return () => { maintenance.current = null; void owner.dispose() }
    }, [])

    // Use the same plan for the displayed mapping indices and filesystem operations.
    const selectedMappings = (() => {
      const s = api.settings.get() as { profiles?: Array<Record<string, unknown>> }
      const raw = (s.profiles ?? []).find((p) => str(p.id) === selectedId)
      const rows = Array.isArray(raw?.mappings) ? (raw?.mappings as Array<Record<string, unknown>>) : []
      return rows
        .map((m) => ({ name: str(m.name).trim(), source: str(m.source).trim(), destination: str(m.destination).trim() }))
        .filter((m) => m.source && m.destination)
    })()

    const runPrune = async (): Promise<void> => {
      const owner = maintenance.current
      const preview = owner?.begin(selectedId, true)
      if (!owner || !preview) {
        if (owner && operations.isActive()) setMaint({ kind: 'note', text: uiText('auto.2700ef39cb59') })
        return
      }
      setMaint({ kind: 'busy', label: uiText('auto.b2b841a7fc71') })
      const dry = await owner.run(preview, (signal) => backupApi(api).prune(preview.plan, { dryRun: true }, signal))
      if (!owner.isCurrent(preview)) return
      if (!dry?.ok || !dry.data) {
        setMaint({ kind: 'note', text: uiText('auto.2700ef39cb59') })
        return
      }
      if (dry.data.dropped.length === 0) {
        setMaint({ kind: 'note', text: uiText('auto.cc54e62c3e08', { p0: dry.data.kept }) })
        return
      }
      if (owner.ready(preview)) setMaint({ kind: 'prune-counted', preview, drop: dry.data.dropped.length, kept: dry.data.kept })
    }
    const confirmPrune = async (preview: MaintenancePreview): Promise<void> => {
      const owner = maintenance.current
      if (!owner?.confirm(preview)) return
      setMaint({ kind: 'busy', label: uiText('auto.f7b023b83c72') })
      const res = await owner.run(preview, (signal) => backupApi(api).prune(preview.plan, { dryRun: false }, signal))
      if (!owner.isCurrent(preview)) return
      setMaint({
        kind: 'note',
        text:
          res?.ok && res.data
            ? uiText('auto.0c2cf66ed63c', { p0: res.data.dropped.length, p1: res.data.kept }) +
              (res.data.errors.length ? uiText('auto.0943b157227c', { p0: res.data.errors.length }) : '')
            : uiText('auto.2700ef39cb59')
      })
    }
    const planRestore = async (mi: number): Promise<void> => {
      const owner = maintenance.current
      const preview = owner?.begin(selectedId, false, mi)
      if (!owner || !preview) {
        if (owner && operations.isActive()) setMaint({ kind: 'note', text: uiText('auto.d7f2768ca570') })
        return
      }
      setMaint({ kind: 'busy', label: uiText('auto.1c36bd34ec77') })
      const res = await owner.run(preview, (signal) => backupApi(api).restorePlan(preview.plan, mi, signal))
      if (!owner.isCurrent(preview)) return
      if (!res?.ok || !res.data?.ok) {
        setMaint({ kind: 'note', text: uiText('auto.d7f2768ca570') })
        return
      }
      if (owner.ready(preview)) setMaint({
        kind: 'restore-plan',
        preview,
        creates: res.data.creates.length,
        updates: res.data.updates.length,
        deletes: res.data.deletes.length,
        skipped: res.data.skipped ?? []
      })
    }
    const applyRestore = async (preview: MaintenancePreview): Promise<void> => {
      const owner = maintenance.current
      if (preview.mappingIndex === undefined || !owner?.confirm(preview)) return
      setMaint({ kind: 'busy', label: uiText('auto.df34924ef17e') })
      const res = await owner.run(preview, (signal) => backupApi(api).restoreApply(preview.plan, preview.mappingIndex!, signal))
      if (!owner.isCurrent(preview)) return
      setMaint({
        kind: 'note',
        text:
          res?.ok && res.data?.ok
            ? uiText('auto.dfdc3dc9aa44', { p0: res.data.creates.length + res.data.updates.length })
            : uiText('auto.c848a612ec9b'),
        skipped: res?.data?.skipped ?? []
      })
    }

    // Overall progress across all mappings (drives the steady progress bar).
    const overall = progress
      ? Math.min(
          100,
          Math.round(
            ((progress.mappingIndex - 1 + (progress.phase === 'scanning' ? 0 : progress.percent / 100)) /
              Math.max(1, progress.mappingCount)) *
              100
          )
        )
      : 0
    // Never let the bar regress (a failed/skipped mapping can report a lower value).
    const displayOverall = status === 'running' ? Math.max(maxOverallRef.current, overall) : overall
    if (status === 'running') maxOverallRef.current = displayOverall

    // Steady, self-correcting "time left": project the total from elapsed/progress
    // once progress is real (>3%), else lean on the up-front history estimate.
    const elapsedSec = status === 'running' && startedAt ? (Date.now() - startedAt) / 1000 : 0
    const projectedTotal = displayOverall > 3 ? elapsedSec * (100 / displayOverall) : estimateSec
    const remainingSec =
      projectedTotal != null ? Math.max(0, projectedTotal - elapsedSec) : progress?.etaSeconds ?? null
    const etaLabel =
      displayOverall <= 3
        ? estimateSec != null
          ? uiText('auto.82a68202d381', { p0: formatDuration(estimateSec, language) })
          : uiText('auto.e8642ee5ad7e')
        : remainingSec != null
          ? uiText('auto.dba2fb67adfe', { p0: formatDuration(remainingSec, language) })
          : ''

    const statusTone = status === 'failed' ? ' is-failed' : status === 'done' ? ' is-done' : ''
    const statusText =
      status === 'running'
        ? progress
          ? progress.phase === 'scanning'
            ? uiText('auto.414f279b51ef', { p0: progress.folder })
            : uiText('auto.f73992337e2d', { p0: progress.folder })
          : uiText('auto.e5f58095ac29')
        : status === 'done' || status === 'stopped'
          ? summary
          : status === 'failed'
            ? summary || uiText('auto.09fef5d8d9a3')
            : uiText('auto.cc1ebdd04e76')

    // ---- Small building blocks (all styling lives in styles.ts) -----------
    const btn = (
      label: string,
      onClick: () => void,
      opts: { variant?: 'accent' | 'quiet'; disabled?: boolean; wide?: boolean } = {}
    ): ReturnType<typeof h> =>
      h(
        'button',
        {
          className:
            'backup-btn' +
            (opts.variant ? ` backup-btn--${opts.variant}` : '') +
            (opts.wide ? ' backup-btn--wide' : ''),
          disabled: opts.disabled,
          onClick
        },
        label
      )

    const sectionHead = (title: string, action?: ReturnType<typeof h> | null): ReturnType<typeof h> =>
      h('div', { className: 'backup-section' }, h('span', { className: 'backup-section-title' }, title), action ?? null)

    const emptyState = (text: string, action?: ReturnType<typeof h> | null): ReturnType<typeof h> =>
      h('div', { className: 'backup-empty' }, h('span', null, text), action ?? null)

    const listRow = (
      key: string,
      icon: ReturnType<typeof h> | null,
      tone: '' | ' is-ok' | ' is-bad',
      label: string,
      sub: string | null,
      meta: string | null,
      actions?: ReturnType<typeof h> | null
    ): ReturnType<typeof h> =>
      h(
        'div',
        { key, className: 'backup-row' },
        icon ? h('span', { className: `backup-row-icon${tone}` }, icon) : null,
        h(
          'div',
          { className: 'backup-row-main' },
          h('span', { className: 'backup-row-label', title: label }, label),
          sub ? h('span', { className: 'backup-row-sub' }, sub) : null
        ),
        meta ? h('span', { className: 'backup-row-meta' }, meta) : null,
        actions ?? null
      )

    const baseName = (p: string): string => p.replace(/\/$/, '').split('/').pop() ?? p

    // ---- Header: title + profile dropdown ---------------------------------
    const profileLabel = profiles.length ? nameFor(selectedId) : uiText('auto.101101ea16da')
    const header = h(
      'div',
      { className: 'panel-header' },
      h(
        'div',
        { className: 'panel-header-label' },
        h('span', { className: 'panel-title' }, uiText('manifest.name'))
      ),
      h(
        'button',
        {
          className: 'backup-profile',
          disabled: status === 'running',
          title: uiText('auto.9952bdb5d01a'),
          'aria-label': uiText('auto.9952bdb5d01a'),
          onClick: (e: { currentTarget: HTMLElement }) => openProfileMenu(e.currentTarget)
        },
        h('span', { className: 'backup-profile-name' }, profileLabel),
        IconChevronDown
      )
    )

    // ---- 37px icon tab strip ----------------------------------------------
    const tabs: Array<{ id: Tab; icon: ReturnType<typeof h>; label: string }> = [
      { id: 'status', icon: status === 'running' ? IconLoader : IconHardDrive, label: uiText('auto.bae7d5be7082') },
      { id: 'details', icon: IconList, label: uiText('auto.7e3112f57746') },
      { id: 'recent', icon: IconHistory, label: uiText('auto.a584451ceaf9') },
      { id: 'archives', icon: IconArchive, label: uiText('auto.a50710e773e1') }
    ]
    const settingsLabel = uiText('auto.432e860f10ff')
    const tabStrip = h(
      'div',
      { className: 'backup-tabs', role: 'tablist' },
      ...tabs.map((item) =>
        h(
          'button',
          {
            key: item.id,
            className: `backup-tab${tab === item.id ? ' active' : ''}`,
            role: 'tab',
            'aria-selected': tab === item.id,
            title: item.label,
            'aria-label': item.label,
            onClick: () => setTab(item.id)
          },
          item.icon
        )
      ),
      h(
        'button',
        {
          className: 'backup-tab backup-tab--end',
          title: settingsLabel,
          'aria-label': settingsLabel,
          onClick: openSettings
        },
        IconSliders
      )
    )

    // A run stays visible from every tab.
    const runLine =
      status === 'running' && tab !== 'status'
        ? h('div', { className: 'backup-runline' }, h('i', { style: { width: `${displayOverall}%` } }))
        : null

    // ---- Status tab --------------------------------------------------------
    // Pre-flight alert with actionable buttons (no raw error spam). One drive
    // that is not mounted fails every mapping pointing at it, so the same
    // message arrives once per folder — show each distinct reason once.
    const uniqueIssues = issues.filter(
      (iss, i) => issues.findIndex((other) => other.message === iss.message) === i
    )
    const alertBanner = uniqueIssues.length
      ? h(
          'div',
          { className: 'backup-alert' },
          h(
            'span',
            { className: 'backup-alert-title' },
            IconAlert,
            uiText('auto.cc687f43b582', { p0: nameFor(selectedId) })
          ),
          ...uniqueIssues.map((iss, i) =>
            h('span', { key: String(i), className: 'backup-alert-msg' }, iss.message)
          ),
          h(
            'div',
            { className: 'backup-alert-actions' },
            btn(uiText('auto.432e860f10ff'), openSettings),
            btn(uiText('auto.9f5cd8a2e880'), () => void startRun())
          )
        )
      : null

    const runButton = status === 'running'
      ? h(
          'button',
          { className: 'backup-run backup-run--stop', onClick: () => state.stop(), title: uiText('backup.action.stopHint') },
          IconLoader,
          uiText('backup.action.stop')
        )
      : h(
          'button',
          {
            className: 'backup-run',
            disabled: !profiles.length,
            onClick: () => void startRun()
          },
          uiText('auto.5d5dba0742de')
        )

    // What the running folder has left, in entries and bytes.
    const counts = status === 'running' && progress?.files && progress.phase === 'transferring'
      ? [
          uiText('backup.progress.files', { done: formatCount(progress.files.done, language), total: formatCount(progress.files.total, language) }),
          ...(progress.bytes?.total ? [uiText('backup.progress.bytes', { done: formatBytes(progress.bytes.done, language), total: formatBytes(progress.bytes.total, language) })] : [])
        ].join(' · ')
      : null

    // The selected profile's schedule: when it runs next, or why it is waiting.
    const scheduled = schedules[selectedId]
    const scheduleLine = scheduled && status !== 'running'
      ? scheduled.waiting
        ? h('div', { className: 'backup-schedule is-waiting', role: 'status' }, IconAlert, h('span', null, uiText('backup.schedule.waiting', { reason: scheduled.waiting })))
        : scheduled.nextAt !== null
          ? h('div', { className: 'backup-schedule' }, IconHistory, h('span', null, uiText('backup.schedule.next', { when: scheduled.nextAt <= Date.now() ? uiText('backup.schedule.now') : formatUpcoming(scheduled.nextAt, Date.now(), language, timeFormat === '12h') })))
          : null
      : null

    // One steady overall progress bar for the whole run, with a live ETA.
    const progressBar =
      status === 'running'
        ? h(
            'div',
            { className: 'backup-progress' },
            h('div', { className: 'backup-track' }, h('i', { style: { width: `${displayOverall}%` } })),
            h(
              'div',
              { className: 'backup-progress-meta' },
              h('span', null, `${displayOverall}%`),
              h('span', null, etaLabel)
            ),
            counts ? h('div', { className: 'backup-progress-counts' }, counts) : null
          )
        : null

    const phaseRow = h(
      'div',
      { className: `backup-status${statusTone}` },
      status === 'done' ? IconCheck : status === 'failed' ? IconX : status === 'stopped' ? IconBan : null,
      h('span', { title: statusText }, statusText)
    )

    // Friendly per-folder status list for the active run.
    const foldersTitle = uiText('auto.19adc47be34b')
    const folderRows = mappingResults.length
      ? [
          sectionHead(foldersTitle),
          h(
            'div',
            { className: 'backup-rows' },
            ...mappingResults.map((m) => {
              const live = status === 'running' && progress && progress.mappingIndex === m.index
              const tone: '' | ' is-ok' | ' is-bad' =
                m.status === 'failed' || m.status === 'skipped' ? ' is-bad' : m.status === 'done' ? ' is-ok' : ''
              // The meta column cannot shrink, so only ever short values go there:
              // a failure reason is a sentence and belongs under the label, or it
              // squeezes the folder name out of the row entirely.
              const detailLabel =
                m.status === 'stopped'
                  ? uiText('backup.history.stopped')
                  : m.status === 'done'
                  ? uiText('auto.d7fd3fcb4bb5', { p0: m.archived ?? 0 })
                  : m.status === 'running'
                    ? live && progress && progress.phase !== 'scanning'
                      ? `${progress.percent}%`
                      : uiText('auto.a95e286913bf')
                    : m.archived
                      ? uiText('auto.d7fd3fcb4bb5', { p0: m.archived })
                      : ''
              const reason = m.status === 'failed' || m.status === 'skipped' ? m.message ?? null : null
              return listRow(String(m.index), STATUS_ICON[m.status], tone, m.folder, reason, detailLabel)
            })
          )
        ]
      : []

    const setupText = uiText('auto.82f841dac7be')
    const setupActionLabel = uiText('auto.bfc7470c583a')
    const statusTab = profiles.length
      ? [alertBanner, runButton, scheduleLine, progressBar, phaseRow, ...folderRows]
      : [emptyState(setupText, btn(setupActionLabel, openSettings))]

    // ---- Live log tab ------------------------------------------------------
    const logTitle = uiText('auto.7e3112f57746')
    const detailsTab = [
      sectionHead(logTitle),
      lines.length
        ? h('pre', { ref: logRef, className: 'backup-log' }, lines.join('\n'))
        : emptyState(uiText('auto.787035ed6c6d'))
    ]

    // ---- Recent tab: the run history ("time log") -------------------------
    const historyOutcome = (rec: HistoryRecord): { icon: ReturnType<typeof h>; tone: '' | ' is-ok' | ' is-bad'; label: string } => {
      if (rec.ok) {
        return {
          icon: IconCheck,
          tone: ' is-ok',
          label: uiText('backup.history.done', { duration: formatDuration(rec.durationSec, language), copied: formatCount(rec.copied, language), archived: formatCount(rec.archived, language) })
        }
      }
      if (rec.reason === RUN_STOPPED) return { icon: IconBan, tone: '', label: uiText('backup.history.stopped') }
      if (rec.reason === RUN_INTERRUPTED) {
        // A row still marked interrupted is the run in progress right now.
        const live = status === 'running' && history[0]?.id === rec.id
        return { icon: live ? IconLoader : IconAlert, tone: live ? '' : ' is-bad', label: uiText(live ? 'auto.f6005584e229' : 'backup.history.interrupted') }
      }
      // A run that never started (drive missing) carries its reason and zero
      // errors — "0 error(s)" would say nothing.
      const label = rec.failedItems
        ? uiText('backup.history.failedItems', { count: formatCount(rec.failedItems, language) })
        : rec.errors
          ? uiText('auto.8b35536332aa', { p0: rec.errors })
          : rec.reason || uiText('auto.09fef5d8d9a3')
      return { icon: IconX, tone: ' is-bad', label }
    }
    const noRunsText = uiText('auto.f7aa648b33ac')
    const recentTab = [
      historyError ? h('p', { role: 'alert' }, historyError) : null,
      sectionHead(uiText('auto.a584451ceaf9')),
      history.length
        ? h(
            'div',
            { className: 'backup-rows' },
            ...history.map((rec) => {
              const outcome = historyOutcome(rec)
              const subLabel = rec.trigger === 'scheduled' ? uiText('backup.history.scheduled', { detail: outcome.label }) : outcome.label
              return listRow(
                rec.id,
                outcome.icon,
                outcome.tone,
                rec.profileName,
                subLabel,
                formatRelative(rec.startedAt, language, dateFormat)
              )
            })
          )
        : emptyState(noRunsText)
    ]

    // ---- Archives tab: retention cleanup + restore ------------------------
    const maintBusy = maint.kind === 'busy' || status === 'running'
    const noFoldersText = uiText('auto.5f88ae056e7b')
    const archivesTab = [
      sectionHead(
        uiText('auto.a50710e773e1'),
        btn(uiText('auto.197e112d07bd'), () => void runPrune(), { variant: 'quiet', disabled: maintBusy })
      ),
      h(
        'span',
        { className: 'backup-note' },
        uiText('auto.62f3dd5a9d1f')
      ),
      selectedMappings.length
        ? h(
            'div',
            { className: 'backup-rows' },
            ...selectedMappings.map((m, mi) =>
              listRow(
                `${m.source}→${m.destination}`,
                null,
                '',
                m.name || baseName(m.source),
                null,
                null,
                h(
                  'div',
                  { className: 'backup-row-actions' },
                  btn(uiText('auto.90c0c2eb98de'), () =>
                    void backupApi(api).reveal(operations.plan(selectedId || undefined), m.destination)
                  ),
                  btn(uiText('auto.54a694543dfe'), () => void planRestore(mi), { disabled: maintBusy })
                )
              )
            )
          )
        : emptyState(noFoldersText, btn(uiText('auto.112053b66c92'), openSettings)),
      maint.kind === 'busy' ? h('span', { className: 'backup-note' }, maint.label) : null,
      maint.kind === 'note' ? h('span', { className: 'backup-note' }, maint.text) : null,
      (maint.kind === 'note' || maint.kind === 'restore-plan') && maint.skipped?.length ? h('span', { className: 'backup-note', role: 'status' }, uiText('backup.restore.skipped', { paths: maint.skipped.join(', ') })) : null,
      maint.kind === 'prune-counted'
        ? h(
            'div',
            { className: 'backup-card' },
            h('span', { className: 'backup-card-text' }, uiText('auto.8911ca48fa04', { p0: maint.drop, p1: maint.kept })),
            h(
              'div',
              { className: 'backup-card-actions' },
              btn(uiText('auto.e963907dac5c'), () => void confirmPrune(maint.preview), { variant: 'accent', wide: true }),
              btn(uiText('auto.77dfd2135f4d'), () => maintenance.current?.cancel(maint.preview), { variant: 'quiet' })
            )
          )
        : null,
      maint.kind === 'restore-plan'
        ? h(
            'div',
            { className: 'backup-card' },
            h(
              'span',
              { className: 'backup-card-text' },
              uiText('auto.a0498c8d2c44', { p0: maint.creates, p1: maint.updates, p2: maint.deletes })
            ),
            h(
              'div',
              { className: 'backup-card-actions' },
              btn(uiText('auto.6f6c3dd91f16'), () => void applyRestore(maint.preview), {
                variant: 'accent',
                wide: true
              }),
              btn(uiText('auto.77dfd2135f4d'), () => maintenance.current?.cancel(maint.preview), { variant: 'quiet' })
            )
          )
        : null
    ]

    const body =
      tab === 'details' ? detailsTab : tab === 'recent' ? recentTab : tab === 'archives' ? archivesTab : statusTab

    return h(
      'div',
      { className: 'panel backup-panel' },
      header,
      tabStrip,
      runLine,
      h(
        'div',
        {
          className: `panel-body backup-body${tab === 'details' ? ' backup-body--fill' : ''}`,
          role: 'tabpanel'
        },
        ...body
      )
    )
  }

  return BackupPanel
}
