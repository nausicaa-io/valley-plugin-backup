import type { ValleyPluginApi } from '@valley/plugin-sdk'
import type { BackupIcons } from './icons'
import { genId, type createProfileStore, type Profile, type Row } from './profiles'
import { uiText } from './localization'

const emptyRow = (): Row => ({ source: '', destination: '', exclude: [] })
const editableRows = (profile: Profile): Row[] => profile.rows.length ? profile.rows : [emptyRow()]

type SettingsViewState = { kind: 'list' } | { kind: 'profile'; id: string }

export function createBackupSettings(api: ValleyPluginApi, profileStore: ReturnType<typeof createProfileStore>, icons: BackupIcons) {
  const React = api.React
  const h = React.createElement
  const { IconChevronLeft, IconChevronRight, IconPlus, IconHardDrive } = icons
  const Exclusions = ({ row, onChange, index }: { row: Row; onChange: (exclude: string[]) => void; index: number }): ReturnType<typeof h> => {
    const { ChipsField, Row: SettingsRow } = api.ui.settings
    return h(SettingsRow, { title: uiText('auto.f4c16b17ee40'), description: uiText('backup.exclude.help') },
      h(ChipsField, {
        items: row.exclude,
        onChange,
        ariaLabel: `${uiText('auto.f4c16b17ee40')} ${index + 1}`,
        placeholder: 'nested/, *.tmp',
        commitOn: ['enter', 'blur'],
        removable: true,
        className: 'backup-settings-field'
      })
    )
  }
  const SettingsView = ({ profileId }: { profileId?: string } = {}): ReturnType<typeof h> => {
    const { Button, OsFolderField, Row: SettingsRow, Section, TextField, Toggle } =
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
        rows: [emptyRow()],
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
      if (await confirmRemoval(row.name?.trim() || row.source.trim() || uiText('auto.4fe8252005e3', { p0: ri + 1 }))) removeRow(pi, ri)
    }

    const patchRow = (pi: number, ri: number, patch: Partial<Row>): void => {
      setProfiles((prev) => prev.map((profile, idx) =>
        idx === pi
          ? { ...profile, rows: editableRows(profile).map((row, rowIndex) => rowIndex === ri ? { ...row, ...patch } : row) }
          : profile
      ))
    }
    const patchRowPersist = (pi: number, ri: number, patch: Partial<Row>): void => {
      setProfiles((prev) => {
        const next = prev.map((profile, idx) =>
          idx === pi
            ? { ...profile, rows: editableRows(profile).map((row, rowIndex) => rowIndex === ri ? { ...row, ...patch } : row) }
            : profile
        )
        persist(next)
        return next
      })
    }
    const addRow = (pi: number): void => {
      patchProfilePersist(pi, {
        rows: editableRows(profiles[pi]).concat(emptyRow())
      })
    }
    const removeRow = (pi: number, ri: number): void => {
      if (profiles[pi].rows.length <= 1) return
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
          h(TextField, {
            value: row.name ?? '',
            placeholder: uiText('auto.4fe8252005e3', { p0: ri + 1 }),
            ariaLabel: `${uiText('backup.folder.name')} ${ri + 1}`,
            onChange: (value: string) => patchRow(pi, ri, { name: value }),
            onCommit: (value: string) => patchRowPersist(pi, ri, { name: value }),
            className: 'backup-settings-folder-name'
          }),
          editableRows(profiles[pi]).length > 1 && h(
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
            required: Boolean(row.source.trim() || row.destination.trim()),
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
            required: Boolean(row.source.trim() || row.destination.trim()),
            browse: true
          })
        ),
        h(Exclusions, { row, index: ri, onChange: (exclude: string[]) => patchRowPersist(pi, ri, { exclude }) })
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
          SettingsRow,
          { title: uiText('backup.retention.title'), description: uiText('backup.retention.description') },
          h(Toggle, {
            checked: profile.retention !== 'off',
            onChange: (value: boolean) => patchProfilePersist(pi, { retention: value ? 'standard' : 'off' }),
            label: uiText('backup.retention.title')
          })
        ),
        ...editableRows(profile).map((row, ri) => folderCard(pi, row, ri)),
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
          h('h4', { className: 'settings-label' }, uiText('manifest.name')),
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
          profiles.length === 0 && h(
            'div',
            { className: 'backup-empty' },
            h('span', { className: 'backup-settings-glyph backup-settings-glyph--large', 'aria-hidden': true }, IconHardDrive),
            h('span', null, uiText('auto.82f841dac7be'))
          ),
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

  return SettingsView
}
