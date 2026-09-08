/**
 * Backup — a plugin with a left-sidebar panel. The user keeps any number
 * of independent backup *profiles* (e.g. one per external drive), picks one from
 * the header dropdown, and "Back up now" triggers the native mirror backup for that
 * profile in the main process, streaming its output live. The main-process work
 * runs through the SDK's `backup` driver (declared in the manifest):
 * `api.drivers.backup.run(profileId)` starts it and `api.drivers.backup.onProgress()`
 * streams log lines/progress back.
 *
 * Panel chrome: the standard 37px `.panel-header` (title + profile dropdown) over a
 * second 37px icon-tab strip — Status · Live log · Recent · Archives, plus a gear
 * into Settings. The profile picker is `api.ui.openMenu`, never a `<select>`, so it
 * follows Appearance → Action menus (in-app menu vs native OS menu). Tab state is
 * local, so switching tabs never interrupts a running backup; while a run is active
 * on another tab a hairline of progress stays under the strip. All styling lives in
 * `styles.ts`.
 *
 * It uses `api.React` only (no bare imports) so esbuild produces a standalone
 * bundle.
 */
import { PLUGIN_SURFACE_V1, type ValleyPluginApi, type ValleyPluginModule, type UiMenuItem } from '@valley/plugin-sdk'
import type { BackupIssue, BackupMappingResult, BackupProgressUpdate, BackupResult } from '@valley/plugin-sdk/types'
import { initLocalization } from './localization'
import { uiText } from './localization'
import { injectStyles } from './styles'
import { createBackupOperations, registerBackupCommands } from './commands'
import { createProfileStore, genId, parseProfiles, str, type Profile, type Row } from './profiles'

type Status = 'idle' | 'running' | 'done' | 'failed'

const MAX_LOG_LINES = 800
const MAX_HISTORY = 50

/** `95` → `1m 35s`, `40` → `40s`. */
function formatEta(seconds: number, locale: string): string {
  const s = Math.max(0, Math.round(seconds))
  const unit = (value: number, name: 'minute' | 'second'): string =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'short' }).format(value)
  if (s < 60) return unit(s, 'second')
  return new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format([
    unit(Math.floor(s / 60), 'minute'),
    unit(s % 60, 'second')
  ])
}

/** A past run shown in the "Recent backups" time log. */
type HistoryRecord = {
  id: string
  startedAt: string
  profileName: string
  durationSec: number
  archived: number
  errors: number
  ok: boolean
  reason?: string
}

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

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ---- Profile model (mirrors src/main/vault/backup.ts) ----------------------

type SettingsViewState = { kind: 'list' } | { kind: 'profile'; id: string }

/** The panel's four icon tabs (see `styles.ts` → `.backup-tabs`). */
type Tab = 'status' | 'details' | 'recent' | 'archives'

export function register(api: ValleyPluginApi): () => void {
  initLocalization(api)
  const disposeStyles = injectStyles()
  const React = api.React
  const h = React.createElement
  const profileStore = createProfileStore(api)
  const operations = createBackupOperations(api, profileStore)
  let backupView = { profileId: str(api.settings.get().activeProfileId), tab: 'status' as Tab }
  const viewListeners = new Set<() => void>()
  const emitView = (): void => { for (const listener of viewListeners) listener() }
  const subscribeView = (listener: () => void): (() => void) => { viewListeners.add(listener); return () => { viewListeners.delete(listener) } }
  const updateView = (patch: Partial<typeof backupView>): void => {
    const next = { ...backupView, ...patch }
    if (next.profileId === backupView.profileId && next.tab === backupView.tab) return
    backupView = next
    emitView()
  }
  const offProfileView = profileStore.subscribe(emitView)

  // Inline Lucide-style SVG icons — a standalone plugin bundle can't import
  // `react-icons` (it would pull in a second React), so we hand-roll the glyphs
  // the core UI shows via `react-icons/lu`. Same pattern as todo/music icons.
  const svg = (
    children: Array<ReturnType<typeof h>>,
    style?: Record<string, unknown>
  ): ReturnType<typeof h> =>
    h(
      'svg',
      {
        width: '1em',
        height: '1em',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { flex: 'none', ...style }
      },
      ...children
    )

  const IconCheck = svg([h('path', { d: 'M20 6 9 17l-5-5' })])
  const IconX = svg([h('path', { d: 'M18 6 6 18M6 6l12 12' })])
  const IconBan = svg([h('circle', { cx: 12, cy: 12, r: 10 }), h('path', { d: 'm4.9 4.9 14.2 14.2' })])
  const IconLoader = svg([h('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' })], {
    animation: 'notes-backup-spin 0.8s linear infinite'
  })
  const IconChevronDown = svg([h('path', { d: 'm6 9 6 6 6-6' })])
  const IconChevronLeft = svg([h('path', { d: 'm15 18-6-6 6-6' })])
  const IconChevronRight = svg([h('path', { d: 'm9 18 6-6-6-6' })])
  const IconPlus = svg([h('path', { d: 'M12 5v14M5 12h14' })])
  const IconHardDrive = svg([
    h('path', { d: 'M22 12H2' }),
    h('path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }),
    h('path', { d: 'M6 16h.01M10 16h.01' })
  ])
  const IconList = svg([h('path', { d: 'M3 6h.01M3 12h.01M3 18h.01M8 6h13M8 12h13M8 18h13' })])
  const IconHistory = svg([
    h('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
    h('path', { d: 'M3 3v5h5' }),
    h('path', { d: 'M12 7v5l4 2' })
  ])
  const IconArchive = svg([
    h('rect', { width: 20, height: 5, x: 2, y: 3, rx: 1 }),
    h('path', { d: 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8' }),
    h('path', { d: 'M10 12h4' })
  ])
  const IconSliders = svg([
    h('path', { d: 'M20 7h-9M14 17H5' }),
    h('circle', { cx: 17, cy: 17, r: 3 }),
    h('circle', { cx: 7, cy: 7, r: 3 })
  ])
  const IconAlert = svg([
    h('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }),
    h('path', { d: 'M12 9v4M12 17h.01' })
  ])

  const STATUS_ICON: Record<BackupMappingResult['status'], ReturnType<typeof h>> = {
    running: IconLoader,
    done: IconCheck,
    skipped: IconBan,
    failed: IconX
  }

  const BackupPanel = (): ReturnType<typeof h> => {
    const [status, setStatus] = React.useState<Status>('idle')
    const [summary, setSummary] = React.useState('')
    const [lines, setLines] = React.useState<string[]>([])
    const [progress, setProgress] = React.useState<BackupProgressUpdate | null>(null)
    const [mappingResults, setMappingResults] = React.useState<BackupMappingResult[]>([])
    const [issues, setIssues] = React.useState<BackupIssue[]>([])
    const [profiles, setProfiles] = React.useState<Array<{ id: string; name: string }>>([])
    const viewState = React.useSyncExternalStore(subscribeView, () => backupView)
    const selectedId = viewState.profileId
    const setSelectedId = (next: string | ((previous: string) => string)): void => updateView({ profileId: typeof next === 'function' ? next(backupView.profileId) : next })
    const [history, setHistory] = React.useState<HistoryRecord[]>([])
    const tab = viewState.tab
    const setTab = (next: Tab): void => updateView({ tab: next })
    const [estimateSec, setEstimateSec] = React.useState<number | null>(null)
    // General → Date format, live: the host pushes preference changes through
    // `api.subscribe` (same route the clock panel uses for weekStart/timeFormat).
    const [dateFormat, setDateFormat] = React.useState(() => api.getState().dateFormat)
    React.useEffect(() => api.subscribe(() => setDateFormat(api.getState().dateFormat)), [])
    const [, bumpTick] = React.useState(0)
    const runStartedAtRef = React.useRef(0)
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

    const loadHistory = React.useCallback((): void => {
      void api.data.dataset('backup_runs')
        .query({ orderBy: [{ field: 'startedAt', direction: 'desc' }], limit: MAX_HISTORY })
        .then(({ rows: recs }) => {
          const list: HistoryRecord[] = recs.map((r) => ({
            id: str(r.id),
            startedAt: str(r.startedAt),
            profileName: str(r.profileName) || 'Backup',
            durationSec: num(r.durationSec),
            archived: num(r.archived),
            errors: num(r.errors),
            ok: r.ok === true || r.ok === 'true',
            reason: r.reason ? str(r.reason) : undefined
          }))
          list.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
          setHistory(list.slice(0, MAX_HISTORY))
        })
    }, [])

    React.useEffect(() => {
      refreshProfiles()
      loadHistory()
      // Settings edits (profiles added/renamed) dispatch this — keep the dropdown
      // and selection in sync without a reload.
      const onSettings = (): void => {
        refreshProfiles()
      }
      return api.settings.subscribe(onSettings)
    }, [refreshProfiles, loadHistory])

    React.useEffect(() => {
      const off = api.drivers.backup.onProgress((p) => {
        if (p.update) {
          setProgress(p.update)
          return
        }
        if (p.mapping) {
          const m = p.mapping
          setMappingResults((prev) => {
            const next = prev.filter((x) => x.index !== m.index)
            next.push(m)
            next.sort((a, b) => a.index - b.index)
            return next
          })
          return
        }
        if (p.line === undefined) return
        const line = p.line
        setLines((prev) => {
          const next = prev.concat(line)
          return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
        })
      })
      return off
    }, [])

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
      setIssues([])
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

    const startRun = async (): Promise<void> => {
      if (status === 'running') return
      setIssues([])
      // 1. Pre-flight — block with a clear alert instead of spewing mirror errors.
      const pre = await api.drivers.backup.check(selectedId || undefined)
      if (!pre.ok || !pre.data || !pre.data.ok) {
        setIssues(
          pre.data?.issues ?? [
            { kind: 'dest-error', message: uiText('auto.e97ecd4af356') }
          ]
        )
        setStatus('failed')
        setSummary('')
        return
      }
      // 2. Run.
      setLines([])
      setSummary('')
      setProgress(null)
      setMappingResults([])
      // Estimate total time up front from the most recent successful run of this
      // profile (fall back to any recent success); refined live from progress.
      const profName = nameFor(selectedId)
      const prior = history.find((r) => r.ok && r.profileName === profName) ?? history.find((r) => r.ok)
      setEstimateSec(prior ? prior.durationSec : null)
      runStartedAtRef.current = Date.now()
      maxOverallRef.current = 0
      setStatus('running')
      const invoked = await operations.run(selectedId || undefined, true)
      const result: BackupResult | undefined = invoked.data
      setProgress(null)
      if (!invoked.ok || !result) {
        setStatus('failed')
        setSummary(uiText('auto.beb2ea0a45a6'))
        return
      }
      // A drive can unmount between check and run — surface that as an alert too.
      if (result.issues && result.issues.length) setIssues(result.issues)
      const ok = result.ok
      setStatus(ok ? 'done' : 'failed')
      // `errors` counts folders, so a folder that failed over 6515 entries used
      // to report "1 error(s)" — say what actually went wrong when we know it.
      setSummary(
        ok
          ? uiText('auto.1d164664f6ed', { p0: result.archived, p1: result.durationSec })
          : uiText('auto.a6df420d2c59', { p0: result.failedItems || result.errors })
      )
      loadHistory()
    }

    // ---- Archive maintenance: retention cleanup + restore preview/apply ----
    const [maint, setMaint] = React.useState<
      | { kind: 'idle' }
      | { kind: 'busy'; label: string }
      | { kind: 'prune-counted'; drop: number; kept: number }
      | { kind: 'restore-plan'; mappingIndex: number; creates: number; updates: number; deletes: number }
      | { kind: 'note'; text: string }
    >({ kind: 'idle' })

    // Mappings of the selected profile, filtered exactly like the engine's
    // normalizeBackupConfig so mappingIndex lines up with the driver.
    const selectedMappings = (() => {
      const s = api.settings.get() as { profiles?: Array<Record<string, unknown>> }
      const raw = (s.profiles ?? []).find((p) => str(p.id) === selectedId)
      const rows = Array.isArray(raw?.mappings) ? (raw?.mappings as Array<Record<string, unknown>>) : []
      return rows
        .map((m) => ({ source: str(m.source).trim(), destination: str(m.destination).trim() }))
        .filter((m) => m.source && m.destination)
    })()

    const runPrune = async (): Promise<void> => {
      setMaint({ kind: 'busy', label: uiText('auto.b2b841a7fc71') })
      const dry = await api.drivers.backup.prune({ profileId: selectedId || undefined, dryRun: true })
      if (!dry.ok || !dry.data) {
        setMaint({ kind: 'note', text: uiText('auto.2700ef39cb59') })
        return
      }
      if (dry.data.dropped.length === 0) {
        setMaint({ kind: 'note', text: uiText('auto.cc54e62c3e08', { p0: dry.data.kept }) })
        return
      }
      setMaint({ kind: 'prune-counted', drop: dry.data.dropped.length, kept: dry.data.kept })
    }
    const confirmPrune = async (): Promise<void> => {
      setMaint({ kind: 'busy', label: uiText('auto.f7b023b83c72') })
      const res = await api.drivers.backup.prune({ profileId: selectedId || undefined })
      setMaint({
        kind: 'note',
        text:
          res.ok && res.data
            ? uiText('auto.0c2cf66ed63c', { p0: res.data.dropped.length, p1: res.data.kept }) +
              (res.data.errors.length ? uiText('auto.0943b157227c', { p0: res.data.errors.length }) : '')
            : uiText('auto.2700ef39cb59')
      })
    }
    const planRestore = async (mi: number): Promise<void> => {
      setMaint({ kind: 'busy', label: uiText('auto.1c36bd34ec77') })
      const res = await api.drivers.backup.restorePlan(mi, selectedId || undefined)
      if (!res.ok || !res.data?.ok) {
        setMaint({ kind: 'note', text: uiText('auto.d7f2768ca570') })
        return
      }
      setMaint({
        kind: 'restore-plan',
        mappingIndex: mi,
        creates: res.data.creates.length,
        updates: res.data.updates.length,
        deletes: res.data.deletes.length
      })
    }
    const applyRestore = async (mi: number): Promise<void> => {
      setMaint({ kind: 'busy', label: uiText('auto.df34924ef17e') })
      const res = await api.drivers.backup.restoreApply(mi, selectedId || undefined)
      setMaint({
        kind: 'note',
        text:
          res.ok && res.data?.ok
            ? uiText('auto.dfdc3dc9aa44', { p0: res.data.creates.length + res.data.updates.length })
            : uiText('auto.c848a612ec9b')
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
    const elapsedSec = status === 'running' && runStartedAtRef.current ? (Date.now() - runStartedAtRef.current) / 1000 : 0
    const projectedTotal = displayOverall > 3 ? elapsedSec * (100 / displayOverall) : estimateSec
    const remainingSec =
      projectedTotal != null ? Math.max(0, projectedTotal - elapsedSec) : progress?.etaSeconds ?? null
    const etaLabel =
      displayOverall <= 3
        ? estimateSec != null
          ? uiText('auto.82a68202d381', { p0: formatEta(estimateSec, api.ui.language()) })
          : uiText('auto.e8642ee5ad7e')
        : remainingSec != null
          ? uiText('auto.dba2fb67adfe', { p0: formatEta(remainingSec, api.ui.language()) })
          : ''

    const statusTone = status === 'failed' ? ' is-failed' : status === 'done' ? ' is-done' : ''
    const statusText =
      status === 'running'
        ? progress
          ? progress.phase === 'scanning'
            ? uiText('auto.414f279b51ef', { p0: progress.folder })
            : uiText('auto.f73992337e2d', { p0: progress.folder })
          : uiText('auto.e5f58095ac29')
        : status === 'done'
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
        h('span', { className: 'panel-title' }, uiText('auto.dd96994d01e7'))
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

    const runButton = h(
      'button',
      {
        className: 'backup-run',
        disabled: status === 'running' || !profiles.length,
        onClick: () => void startRun()
      },
      status === 'running' ? IconLoader : null,
      status === 'running' ? uiText('auto.f6005584e229') : uiText('auto.5d5dba0742de')
    )

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
            )
          )
        : null

    const phaseRow = h(
      'div',
      { className: `backup-status${statusTone}` },
      status === 'done' ? IconCheck : status === 'failed' ? IconX : null,
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
                m.status === 'done'
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
      ? [alertBanner, runButton, progressBar, phaseRow, ...folderRows]
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
    const noRunsText = uiText('auto.f7aa648b33ac')
    const recentTab = [
      sectionHead(uiText('auto.a584451ceaf9')),
      history.length
        ? h(
            'div',
            { className: 'backup-rows' },
            ...history.map((rec) => {
              // A run that never started (drive missing) carries its reason and
              // zero errors — "0 error(s)" would say nothing.
              const subLabel = rec.ok
                ? uiText('auto.7fd373bab038', { p0: rec.durationSec, p1: rec.archived })
                : rec.errors
                  ? uiText('auto.8b35536332aa', { p0: rec.errors })
                  : rec.reason || uiText('auto.09fef5d8d9a3')
              return listRow(
                rec.id,
                rec.ok ? IconCheck : IconX,
                rec.ok ? ' is-ok' : ' is-bad',
                rec.profileName,
                subLabel,
                formatRelative(rec.startedAt, api.ui.language(), dateFormat)
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
                baseName(m.source),
                null,
                null,
                h(
                  'div',
                  { className: 'backup-row-actions' },
                  btn(uiText('auto.90c0c2eb98de'), () =>
                    void api.drivers.backup.reveal(m.destination, selectedId || undefined)
                  ),
                  btn(uiText('auto.54a694543dfe'), () => void planRestore(mi), { disabled: maintBusy })
                )
              )
            )
          )
        : emptyState(noFoldersText, btn(uiText('auto.112053b66c92'), openSettings)),
      maint.kind === 'busy' ? h('span', { className: 'backup-note' }, maint.label) : null,
      maint.kind === 'note' ? h('span', { className: 'backup-note' }, maint.text) : null,
      maint.kind === 'prune-counted'
        ? h(
            'div',
            { className: 'backup-card' },
            h('span', { className: 'backup-card-text' }, uiText('auto.8911ca48fa04', { p0: maint.drop, p1: maint.kept })),
            h(
              'div',
              { className: 'backup-card-actions' },
              btn(uiText('auto.e963907dac5c'), () => void confirmPrune(), { variant: 'accent', wide: true }),
              btn(uiText('auto.77dfd2135f4d'), () => setMaint({ kind: 'idle' }), { variant: 'quiet' })
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
              btn(uiText('auto.6f6c3dd91f16'), () => void applyRestore(maint.mappingIndex), {
                variant: 'accent',
                wide: true
              }),
              btn(uiText('auto.77dfd2135f4d'), () => setMaint({ kind: 'idle' }), { variant: 'quiet' })
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

  // ---- Settings view: manage backup profiles -------------------------------

  const SettingsView = ({ profileId }: { profileId?: string } = {}): ReturnType<typeof h> => {
    const { Button, ChipsField, OsFolderField, Row: SettingsRow, Section, TextField } =
      api.ui.settings
    const profiles = React.useSyncExternalStore(profileStore.subscribe, profileStore.getSnapshot)
    const setProfiles = profileStore.setDraft
    const [view, setView] = React.useState<SettingsViewState>(profileId ? { kind: 'profile', id: profileId } : { kind: 'list' })
    React.useEffect(() => { if (profileId) setView({ kind: 'profile', id: profileId }) }, [profileId])

    const persist = (next: Profile[]): void => {
      void profileStore.save(next).catch(() => api.ui.confirm({ title: uiText('auto.432e860f10ff'), message: uiText('backup.properties.saveError'), actions: [{ label: uiText('auto.77dfd2135f4d'), value: 'close' }] }))
    }

    const patchProfile = (pi: number, patch: Partial<Profile>): void => {
      setProfiles((prev) => prev.map((p, idx) => (idx === pi ? { ...p, ...patch } : p)))
    }
    const patchProfilePersist = (pi: number, patch: Partial<Profile>): void => {
      setProfiles((prev) => {
        const next = prev.map((p, idx) => (idx === pi ? { ...p, ...patch } : p))
        persist(next)
        return next
      })
    }
    const addProfile = (): void => {
      const profile: Profile = {
        id: genId(),
        name: `Profile ${profiles.length + 1}`,
        rows: [],
        trashPath: '',
        logDirectory: '',
        masterLog: ''
      }
      const next = profiles.concat(profile)
      setProfiles(next)
      persist(next)
      setView({ kind: 'profile', id: profile.id })
    }
    const removeProfile = (pi: number): void => {
      setProfiles((prev) => {
        const next = prev.filter((_, idx) => idx !== pi)
        persist(next)
        return next
      })
    }
    // Deleting a profile or a folder pair drops configuration that cannot be
    // undone from here — ask through the host's confirmation dialog first.
    const confirmRemoval = async (name: string): Promise<boolean> =>
      (await api.ui.confirm({
        title: uiText('auto.ff61c7ba16aa'),
        message: h('span', null, uiText('auto.1bd661da498a', { p0: name })),
        actions: [
          { label: uiText('auto.77dfd2135f4d'), value: 'cancel', variant: 'ghost' },
          { label: uiText('auto.e963907dac5c'), value: 'remove', variant: 'danger' }
        ]
      })) === 'remove'
    const confirmRemoveProfile = async (pi: number): Promise<boolean> => {
      if (!(await confirmRemoval(profiles[pi].name.trim() || uiText('auto.4fe8252005e3', { p0: pi + 1 }))))
        return false
      removeProfile(pi)
      return true
    }
    const confirmRemoveRow = async (pi: number, ri: number): Promise<void> => {
      const row = profiles[pi].rows[ri]
      if (await confirmRemoval(row.source.trim() || uiText('auto.4fe8252005e3', { p0: ri + 1 }))) removeRow(pi, ri)
    }

    const patchRow = (pi: number, ri: number, patch: Partial<Row>): void => {
      setProfiles((prev) => prev.map((profile, idx) =>
        idx === pi
          ? { ...profile, rows: profile.rows.map((row, rowIndex) => rowIndex === ri ? { ...row, ...patch } : row) }
          : profile
      ))
    }
    const patchRowPersist = (pi: number, ri: number, patch: Partial<Row>): void => {
      setProfiles((prev) => {
        const next = prev.map((profile, idx) =>
          idx === pi
            ? { ...profile, rows: profile.rows.map((row, rowIndex) => rowIndex === ri ? { ...row, ...patch } : row) }
            : profile
        )
        persist(next)
        return next
      })
    }
    const addRow = (pi: number): void => {
      patchProfilePersist(pi, {
        rows: profiles[pi].rows.concat({ source: '', destination: '', excludeText: '' })
      })
    }
    const removeRow = (pi: number, ri: number): void => {
      patchProfilePersist(pi, { rows: profiles[pi].rows.filter((_, idx) => idx !== ri) })
    }

    const folderCard = (pi: number, row: Row, ri: number): ReturnType<typeof h> =>
      h(
        'div',
        {
          key: String(ri),
          className: 'backup-settings-folder',
          'data-mapping-index': ri
        },
        h(
          'div',
          { className: 'backup-settings-card-head' },
          h('span', { className: 'settings-toggle-title' }, uiText('auto.4fe8252005e3', { p0: ri + 1 })),
          h(
            Button,
            {
              variant: 'danger',
              size: 'small',
              onClick: () => void confirmRemoveRow(pi, ri),
              'aria-label': `${uiText('auto.e963907dac5c')} ${ri + 1}`
            },
            uiText('auto.e963907dac5c')
          )
        ),
        h(
          SettingsRow,
          { title: uiText('auto.6da13addb000') },
          h(OsFolderField, {
            value: row.source,
            onChange: (value: string) => patchRow(pi, ri, { source: value }),
            onCommit: (value: string) => patchRowPersist(pi, ri, { source: value }),
            placeholder: uiText('auto.0894fe6b352a'),
            ariaLabel: `${uiText('auto.6da13addb000')} ${ri + 1}`,
            className: 'settings-path-input backup-settings-field',
            required: true,
            browse: true
          })
        ),
        h(
          SettingsRow,
          { title: uiText('auto.d42713493ca8') },
          h(OsFolderField, {
            value: row.destination,
            onChange: (value: string) => patchRow(pi, ri, { destination: value }),
            onCommit: (value: string) => patchRowPersist(pi, ri, { destination: value }),
            placeholder: uiText('auto.695e28140cb3'),
            ariaLabel: `${uiText('auto.d42713493ca8')} ${ri + 1}`,
            className: 'settings-path-input backup-settings-field',
            required: true,
            browse: true
          })
        ),
        h(
          SettingsRow,
          { title: uiText('auto.f4c16b17ee40') },
          h(ChipsField, {
            items: row.excludeText.split(',').map((value) => value.trim()).filter(Boolean),
            onChange: (items: string[]) => patchRowPersist(pi, ri, { excludeText: items.join(', ') }),
            ariaLabel: `${uiText('auto.f4c16b17ee40')} ${ri + 1}`,
            placeholder: 'cache/, *.tmp',
            className: 'backup-settings-field'
          })
        )
      )

    const advancedField = (
      pi: number,
      label: string,
      desc: string,
      value: string,
      key: 'trashPath' | 'logDirectory' | 'masterLog'
    ): ReturnType<typeof h> =>
      h(
        SettingsRow,
        { title: label, description: desc },
        key === 'masterLog'
          ? h(TextField, {
              value,
              onChange: (next: string) => patchProfile(pi, { [key]: next }),
              onCommit: (next: string) => patchProfilePersist(pi, { [key]: next }),
              ariaLabel: label,
              className: 'settings-path-input backup-settings-field'
            })
          : h(OsFolderField, {
              value,
              onChange: (next: string) => patchProfile(pi, { [key]: next }),
              onCommit: (next: string) => patchProfilePersist(pi, { [key]: next }),
              ariaLabel: label,
              className: 'settings-path-input backup-settings-field',
              browse: true
            })
      )

    const profileDetail = (profile: Profile, pi: number): ReturnType<typeof h> =>
      h(
        Section,
        { className: 'backup-settings-detail' },
        h(
          'div',
          { className: 'settings-listpage-crumbs' },
          h(
            'button',
            {
              type: 'button',
              className: 'settings-listpage-back',
              'aria-label': uiText('auto.432e860f10ff'),
              title: uiText('auto.432e860f10ff'),
              onClick: () => setView({ kind: 'list' })
            },
            IconChevronLeft
          ),
          h('span', { className: 'settings-crumb settings-crumb-current' }, profile.name)
        ),
        h(
          'div',
          { className: 'backup-settings-identity' },
          h('span', { className: 'backup-settings-glyph backup-settings-glyph--large' }, IconHardDrive),
          h(
            'span',
            { className: 'settings-list-meta' },
            h('span', { className: 'settings-list-name' }, profile.name),
            h('span', { className: 'settings-list-sub' }, `${profile.rows.length} ${uiText('auto.19adc47be34b')}`)
          )
        ),
        h(
          SettingsRow,
          {
            title: uiText('auto.77574766df8d'),
            className: 'backup-settings-profile-name'
          },
          h(TextField, {
            value: profile.name,
            onChange: (value: string) => patchProfile(pi, { name: value }),
            onCommit: (value: string) => patchProfilePersist(pi, { name: value }),
            placeholder: uiText('auto.1df120c8de5c'),
            ariaLabel: `${uiText('auto.77574766df8d')} ${pi + 1}`,
            className: 'settings-path-input backup-settings-field'
          })
        ),
        ...profile.rows.map((row, ri) => folderCard(pi, row, ri)),
        h(
          Button,
          {
            variant: 'secondary',
            size: 'small',
            className: 'backup-settings-add',
            onClick: () => addRow(pi),
            'aria-label': `${uiText('auto.c0d31d3b9d31')} ${pi + 1}`
          },
          uiText('auto.c0d31d3b9d31')
        ),
        advancedField(
          pi,
          uiText('auto.819ad5a4465c'),
          uiText('auto.adeeae4a8510'),
          profile.trashPath,
          'trashPath'
        ),
        advancedField(pi, uiText('auto.11e10c8f488b'), uiText('auto.6f902038d03f'), profile.logDirectory, 'logDirectory'),
        advancedField(
          pi,
          uiText('auto.3ad30e772903'),
          uiText('auto.f9dcc3004855'),
          profile.masterLog,
          'masterLog'
        ),
        h(
          'div',
          { className: 'backup-settings-remove' },
          h(
            Button,
            {
              variant: 'danger',
              size: 'small',
              onClick: async () => {
                if (await confirmRemoveProfile(pi)) setView({ kind: 'list' })
              },
              'aria-label': `${uiText('auto.362a1984d15b')} ${pi + 1}`
            },
            uiText('auto.362a1984d15b')
          )
        )
      )

    const profileList = (): ReturnType<typeof h> =>
      h(
        Section,
        { className: 'backup-settings-list settings-listpage' },
        h(
          'div',
          { className: 'settings-listpage-header' },
          h('h4', { className: 'settings-label' }, uiText('auto.dd96994d01e7')),
          h(
            Button,
            {
              className: 'settings-listpage-add',
              size: 'small',
              'aria-label': uiText('auto.ef04290fc628'),
              title: uiText('auto.ef04290fc628'),
              onClick: addProfile
            },
            IconPlus
          )
        ),
        h(
          'div',
          { className: 'settings-list' },
          ...profiles.map((profile) => {
            const configured = profile.rows.length > 0 && profile.rows.every((row) => row.source.trim() && row.destination.trim())
            return h(
              'div',
              {
                key: profile.id,
                className: 'settings-list-row',
                role: 'button',
                tabIndex: 0,
                'data-profile-id': profile.id,
                onClick: () => setView({ kind: 'profile', id: profile.id }),
                onKeyDown: (event: { key: string; preventDefault(): void }) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setView({ kind: 'profile', id: profile.id })
                }
              },
              h('span', { className: 'backup-settings-glyph' }, IconHardDrive),
              h(
                'span',
                { className: 'settings-list-meta' },
                h('span', { className: 'settings-list-name' }, profile.name),
                h('span', { className: 'settings-list-sub' }, `${profile.rows.length} ${uiText('auto.19adc47be34b')}`)
              ),
              h(
                'span',
                { className: `backup-settings-badge ${configured ? 'is-configured' : 'needs-setup'}` },
                h('span', { className: 'backup-settings-dot' }),
                configured ? uiText('auto.668c5fffd24d') : uiText('auto.bfc7470c583a')
              ),
              h('span', { className: 'settings-list-chevron' }, IconChevronRight)
            )
          })
        )
      )

    if (view.kind === 'profile') {
      const pi = profiles.findIndex((profile) => profile.id === view.id)
      if (pi >= 0) return profileDetail(profiles[pi], pi)
    }
    return profileList()
  }

  api.registerView('backup.panel', BackupPanel)
  api.registerView('backup.settings', SettingsView)

  const offCommand = registerBackupCommands(api, profileStore, operations)
  const offSurface = api.interop.extensions.provide(PLUGIN_SURFACE_V1, {
    id: 'backup.panel', surface: 'left_sidebar', subscribe: subscribeView,
    getSnapshot: () => {
      const profile = profileStore.getSnapshot().find((item) => item.id === backupView.profileId)
      return { title: 'Backup', view: { ...backupView }, ...(profile ? { item: { id: profile.id, title: profile.name, state: { ...backupView } } } : {}) }
    },
    restore: (state) => {
      const profileId = typeof state.profileId === 'string' ? state.profileId : ''
      if (profileId && !profileStore.getSnapshot().some((item) => item.id === profileId)) throw new Error('Backup profile is unavailable')
      const tab = ['status', 'details', 'recent', 'archives'].includes(String(state.tab)) ? state.tab as Tab : 'status'
      updateView({ profileId, tab })
    }
  })
  return () => {
    offCommand()
    offSurface()
    offProfileView()
    viewListeners.clear()
    profileStore.dispose()
    disposeStyles()
  }
}

const plugin: ValleyPluginModule = { register }
export default plugin
