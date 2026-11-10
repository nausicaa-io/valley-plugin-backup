import type { ValleyPluginApi, UiMenuItem } from '@valley/plugin-sdk'
import { backupApi } from './backupApi'
import type { BackupIcons } from './icons'
import type { MirrorMappingResult } from './types'
import type { createBackupPanelState, HistoryRecord } from './panelState'
import type { createBackupScheduler } from './scheduler'
import { parseProfiles, str, type createProfileStore, type Profile, type Row } from './profiles'
import { uiText } from './localization'
import { RUN_INTERRUPTED, RUN_STOPPED } from './commands'
import { formatBytes, formatCount, formatDuration, formatUpcoming } from './format'

export type BackupView = { profileId: string; tab: 'status' | 'details' | 'recent' }
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

export function createBackupPanel(api: ValleyPluginApi, view: { getSnapshot(): BackupView; subscribe(listener: () => void): () => void; update(patch: Partial<BackupView>): void }, icons: BackupIcons, state: ReturnType<typeof createBackupPanelState>, scheduler: Pick<ReturnType<typeof createBackupScheduler>, 'getSnapshot' | 'subscribe'>, profileStore: ReturnType<typeof createProfileStore>) {
  const React = api.React
  const h = React.createElement
  const { IconCheck, IconX, IconBan, IconLoader, IconChevronDown, IconHardDrive, IconList, IconHistory, IconFolderOpen, IconSliders, IconAlert } = icons
  const STATUS_ICON: Record<MirrorMappingResult['status'], ReturnType<typeof h>> = { running: IconLoader, done: IconCheck, skipped: IconBan, failed: IconX, stopped: IconBan }
  const BackupPanel = (): ReturnType<typeof h> => {
    const { status, summary, lines, progress, mappingResults, issues, missingFolders, history, historyError, estimateSec, startedAt } = React.useSyncExternalStore(state.subscribe, state.getSnapshot)
    const schedules = React.useSyncExternalStore(scheduler.subscribe, scheduler.getSnapshot)
    const editableProfiles = React.useSyncExternalStore(profileStore.subscribe, profileStore.getSnapshot)
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
    const focusedValueRef = React.useRef('')

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

    // Leaving a path field commits it, so a click on Backup now waits for that save.
    const startRun = async (): Promise<void> => {
      await profileStore.settled()
      await state.start(selectedId)
    }
    React.useEffect(() => { maxOverallRef.current = 0 }, [startedAt])

    const selectedProfile = editableProfiles.find((p) => p.id === selectedId)
    const selectedRows = (selectedProfile?.rows ?? []).filter((row) => row.source.trim() && row.destination.trim())
    const noFolderSelected = selectedRows.length > 0 && selectedRows.every((row) => row.disabled)

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
    const runningText = progress
      ? progress.phase === 'scanning'
        ? uiText('auto.414f279b51ef', { p0: progress.folder })
        : uiText('auto.f73992337e2d', { p0: progress.folder })
      : uiText('auto.e5f58095ac29')
    const outcomeText =
      status === 'done' || status === 'stopped'
        ? summary
        : status === 'failed'
          ? summary || uiText('auto.09fef5d8d9a3')
          : ''

    // ---- Small building blocks (all styling lives in styles.ts) -----------
    const btn = (label: string, onClick: () => void): ReturnType<typeof h> =>
      h('button', { className: 'backup-btn', onClick }, label)

    const sectionHead = (title: string): ReturnType<typeof h> =>
      h('div', { className: 'backup-section' }, h('span', { className: 'backup-section-title' }, title))

    const emptyState = (text: string, action?: ReturnType<typeof h> | null): ReturnType<typeof h> =>
      h('div', { className: 'backup-empty' }, h('span', null, text), action ?? null)

    const listRow = (
      key: string,
      icon: ReturnType<typeof h> | null,
      tone: '' | ' is-ok' | ' is-bad',
      label: string,
      sub: string | string[] | null,
      meta: string | null
    ): ReturnType<typeof h> =>
      h(
        'div',
        { key, className: 'backup-row' },
        icon ? h('span', { className: `backup-row-icon${tone}` }, icon) : null,
        h(
          'div',
          { className: 'backup-row-main' },
          h('span', { className: 'backup-row-label', title: label }, label),
          ...[sub ?? []].flat().map((line) => h('span', { key: line, className: 'backup-row-sub', title: line }, line))
        ),
        meta ? h('span', { className: 'backup-row-meta' }, meta) : null
      )

    const baseName = (p: string): string => p.replace(/\/$/, '').split('/').pop() ?? p

    // Grants only the clicked folder: a backup drive that is away must not block showing a local source.
    const reveal = async (path: string): Promise<void> => {
      const result = await backupApi(api).reveal({ label: 'reveal', mappings: [{ source: path, destination: path, exclude: [] }], trashPath: '', logDirectory: '', masterLog: '', retention: null }, path)
      if (!result.ok) await api.ui.confirm({ title: uiText('manifest.name'), message: uiText('backup.reveal.failed', { path }), actions: [{ label: uiText('auto.77dfd2135f4d'), value: 'close' }] })
    }
    const revealButton = (rawPath: string): ReturnType<typeof h> => {
      const path = rawPath.trim()
      const label = api.files.revealLabel()
      return h(
        'button',
        { type: 'button', className: 'backup-reveal', disabled: !path, title: label, 'aria-label': path ? `${label}: ${path}` : label, onClick: () => void reveal(path) },
        IconFolderOpen
      )
    }

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
      { id: 'status', icon: IconHardDrive, label: uiText('auto.bae7d5be7082') },
      { id: 'details', icon: IconList, label: uiText('auto.7e3112f57746') },
      { id: 'recent', icon: IconHistory, label: uiText('auto.a584451ceaf9') }
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
          uiText('backup.action.stop')
        )
      : h(
          'button',
          {
            className: 'backup-run',
            disabled: !profiles.length || noFolderSelected,
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
            h('div', { className: 'backup-progress-status', title: runningText }, runningText),
            counts ? h('div', { className: 'backup-progress-counts' }, counts) : null
          )
        : null

    const phaseRow = outcomeText
      ? h(
          'div',
          { className: `backup-status${statusTone}` },
          status === 'done' ? IconCheck : status === 'failed' ? IconX : IconBan,
          h('span', { title: outcomeText }, outcomeText)
        )
      : null

    // What happens to replaced files and to the run's log, for the selected profile.
    const patchSelected = (patch: Partial<Profile>, persist: boolean): void => {
      const next = profileStore.getSnapshot().map((p) => (p.id === selectedId ? { ...p, ...patch } : p))
      if (!persist) {
        profileStore.setDraft(next)
        return
      }
      void profileStore.save(next).catch(() => api.ui.confirm({ title: uiText('auto.432e860f10ff'), message: uiText('backup.properties.saveError'), actions: [{ label: uiText('auto.77dfd2135f4d'), value: 'close' }] }))
    }
    const optionRow = (label: string, enabled: boolean, onToggle: (next: boolean) => void, field: 'trashPath' | 'logDirectory', placeholder: string, note: string | null): ReturnType<typeof h> => {
      const value = selectedProfile?.[field] ?? ''
      return h(
        'div',
        { key: field, className: 'backup-option' },
        h(
          'div',
          { className: 'backup-path' },
          h('input', {
            type: 'checkbox',
            className: 'backup-check',
            title: label,
            'aria-label': label,
            checked: enabled,
            onChange: (e: { target: HTMLInputElement }) => onToggle(e.target.checked)
          }),
          revealButton(value),
          h('input', {
            type: 'text',
            className: 'backup-path-input',
            title: value || label,
            value,
            placeholder,
            spellCheck: false,
            'aria-label': `${label}: ${placeholder}`,
            disabled: !enabled,
            onChange: (e: { target: HTMLInputElement }) => patchSelected({ [field]: e.target.value }, false),
            onFocus: (e: { target: HTMLInputElement }) => { focusedValueRef.current = e.target.value },
            onBlur: (e: { target: HTMLInputElement }) => { if (e.target.value !== focusedValueRef.current) patchSelected({ [field]: e.target.value }, true) },
            onKeyDown: (e: { key: string; currentTarget: HTMLInputElement }) => { if (e.key === 'Enter') e.currentTarget.blur() }
          })
        ),
        note ? h('span', { className: 'backup-note', role: 'status' }, note) : null
      )
    }
    const optionRows = selectedProfile && status !== 'running'
      ? [
          h(
            'div',
            { key: 'options', className: 'backup-options' },
            optionRow(
              uiText('backup.options.keepDeleted'),
              !selectedProfile.noArchive,
              (next) => patchSelected({ noArchive: !next }, true),
              'trashPath',
              uiText('backup.options.keepDeletedPlaceholder'),
              selectedProfile.noArchive ? uiText('backup.options.deletePermanently') : null
            ),
            optionRow(
              uiText('backup.options.log'),
              !selectedProfile.noLogs,
              (next) => patchSelected({ noLogs: !next }, true),
              'logDirectory',
              uiText('backup.options.logPlaceholder'),
              null
            )
          )
        ]
      : []

    const setFolderEnabled = (target: Row, enabled: boolean): void =>
      patchSelected({ rows: (selectedProfile?.rows ?? []).map((row) => {
        if (row !== target) return row
        const { disabled: _disabled, ...rest } = row
        return enabled ? rest : { ...rest, disabled: true }
      }) }, true)
    const pathRow = (path: string): ReturnType<typeof h> =>
      h('div', { className: `backup-path${missingFolders.includes(path) ? ' is-missing' : ''}` }, revealButton(path), h('span', { className: 'backup-path-text', title: path }, path))

    // Every source and destination of the profile, with its state from the current run.
    const foldersTitle = uiText('auto.19adc47be34b')
    const folderRows = selectedRows.length
      ? [
          sectionHead(foldersTitle),
          h(
            'div',
            { className: 'backup-rows' },
            ...selectedRows.map((row) => {
              const source = row.source.trim()
              const destination = row.destination.trim()
              const name = row.name?.trim() || baseName(source)
              const m = row.disabled ? undefined : mappingResults.find((result) => result.source === source && result.destination === destination)
              const tone = !m ? '' : m.status === 'failed' || m.status === 'skipped' ? ' is-bad' : m.status === 'done' ? ' is-ok' : ''
              const live = m?.status === 'running' && status === 'running' && progress?.mappingIndex === m.index && progress.phase !== 'scanning'
              const meta = !m
                ? ''
                : m.status === 'stopped'
                  ? uiText('backup.history.stopped')
                  : live
                    ? `${progress.percent}%`
                    : m.status !== 'running' && m.archived
                      ? uiText('auto.d7fd3fcb4bb5', { p0: m.archived })
                      : ''
              // A failure reason is a sentence: it goes under the paths, never into the head row.
              const missing = !row.disabled && (missingFolders.includes(source) || missingFolders.includes(destination))
              const missingText = uiText('backup.folder.missing')
              const reason = missing ? missingText : m?.status === 'failed' || m?.status === 'skipped' ? m.message : undefined
              return h(
                'div',
                { key: `${source}→${destination}`, className: `backup-folder${row.disabled ? ' is-off' : ''}` },
                h(
                  'div',
                  { className: 'backup-folder-head' },
                  h('input', {
                    type: 'checkbox',
                    className: 'backup-check',
                    checked: !row.disabled && !missing,
                    disabled: status === 'running' || missing,
                    title: missing ? missingText : uiText('backup.folder.include', { name }),
                    'aria-label': uiText('backup.folder.include', { name }),
                    onChange: (e: { target: HTMLInputElement }) => setFolderEnabled(row, e.target.checked)
                  }),
                  h('span', { className: 'backup-row-label', title: name }, name),
                  meta ? h('span', { className: 'backup-row-meta' }, meta) : null,
                  m ? h('span', { className: `backup-row-icon${tone}` }, STATUS_ICON[m.status]) : null
                ),
                pathRow(source),
                pathRow(destination),
                reason ? h('span', { className: 'backup-folder-reason', title: reason }, reason) : null
              )
            })
          )
        ]
      : []

    const setupText = uiText('auto.82f841dac7be')
    const setupActionLabel = uiText('auto.bfc7470c583a')
    const statusTab = profiles.length
      ? [alertBanner, runButton, noFolderSelected ? h('span', { className: 'backup-note', role: 'status' }, uiText('backup.folder.noneSelected')) : null, scheduleLine, progressBar, phaseRow, ...optionRows, ...folderRows]
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

    const body =
      tab === 'details' ? detailsTab : tab === 'recent' ? recentTab : statusTab

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
