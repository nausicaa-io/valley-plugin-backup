import fs from 'node:fs'
import path from 'node:path'

export async function verify(context) {
  const { client, evaluate, waitFor, selectSettingsPage, editInput, readDatasetRows, readJson, vault, scratch } = context
  const scratchRoot = fs.realpathSync(scratch)
  const lexicalRelative = path.relative(path.resolve(scratch), path.resolve(vault))
  if (!lexicalRelative || lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) throw new Error('The vault must be inside the disposable scratch directory')
  const sentinel = JSON.parse(fs.readFileSync(path.join(scratchRoot, '.valley-test-run.json'), 'utf8'))
  const vaultRoot = fs.realpathSync(vault)
  const relative = path.relative(scratchRoot, vaultRoot)
  if (sentinel.version !== 1 || !/^[a-z0-9][a-z0-9-]*$/.test(sentinel.kind ?? '') || !relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('This workflow requires a disposable vault inside a sentinel-protected scratch run')
  }
  const liveVault = await evaluate(`(async () => (await window.valley.getVault())?.path ?? null)()`, true)
  if (typeof liveVault !== 'string' || (path.resolve(liveVault) !== path.resolve(vault) && path.resolve(liveVault) !== vaultRoot)) throw new Error('This workflow refuses to drive a different live vault')
  const backupMissingSource = path.join(scratch, 'missing-backup-source')
  const backupSource = path.join(scratch, 'backup-source')
  const backupDestination = path.join(scratch, 'backup-destination')
  const backupTrash = path.join(scratch, 'backup-trash')
  const backupLogs = path.join(scratch, 'backup-logs')
  const backupMasterLog = path.join(scratch, 'backup-master.log')

  await evaluate(`document.querySelector('[data-tooltip-command="open-settings"]')?.click()`)
  await waitFor(() => evaluate(`!!document.querySelector('.settings-layout')`), 'Settings')
  await selectSettingsPage(evaluate, 'Backup', '.backup-settings-list')
  await evaluate(`document.querySelector('.backup-settings-list .settings-listpage-add')?.click()`)
  await waitFor(
    () => evaluate(`!!document.querySelector('.backup-settings-detail')`),
    'Backup profile editor'
  )
  await evaluate(`document.querySelector('.backup-settings-detail .backup-settings-add')?.click()`)
  await waitFor(
    () => evaluate(`!!document.querySelector('.backup-settings-folder')`),
    'Backup mapping editor'
  )
  await editInput(client, 'Source 1', backupMissingSource)
  await editInput(client, 'Destination 1', backupDestination)
  const backupSettingsFile = path.join(vault, '.valley', 'plugins', 'data', 'backup', 'config.json')
  await waitFor(
    async () => {
      if (!fs.existsSync(backupSettingsFile)) return false
      const mapping = readJson(backupSettingsFile).profiles?.[0]?.mappings?.[0]
      return mapping?.source === backupMissingSource && mapping?.destination === backupDestination
    },
    'Backup profile persistence'
  )

  await evaluate(`document.querySelector('.modal-close')?.click()`)
  // Backup first proves that preflight blocks a missing source without creating
  // the destination, then exercises the real native mirror and maintenance UI.
  await waitFor(
    () => evaluate(`[...document.querySelectorAll('.icon-rail-btn')]
      .some((button) => button.getAttribute('aria-label') === 'Backup')`),
    'packaged Backup rail contribution'
  )
  await evaluate(`(() => {
    const button = [...document.querySelectorAll('.icon-rail-btn')]
      .find((item) => item.getAttribute('aria-label') === 'Backup')
    if (!button?.classList.contains('active')) button?.click()
  })()`)
  await waitFor(() => evaluate(`!!document.querySelector('.backup-panel')`), 'packaged Backup panel')
  await evaluate(`document.querySelector('.backup-run')?.click()`)
  await waitFor(() => evaluate(`!!document.querySelector('.backup-alert')`), 'packaged Backup preflight failure')
  if (fs.existsSync(backupDestination)) throw new Error('Backup preflight created the blocked destination')

  fs.mkdirSync(backupSource, { recursive: true })
  fs.mkdirSync(backupDestination, { recursive: true })
  fs.writeFileSync(path.join(backupSource, 'new.md'), 'new file')
  fs.writeFileSync(path.join(backupSource, 'changed.md'), 'new and longer contents')
  fs.writeFileSync(path.join(backupDestination, 'changed.md'), 'old contents')
  fs.writeFileSync(path.join(backupDestination, 'gone.md'), 'deleted contents')

  await evaluate(`document.querySelector('[data-tooltip-command="open-settings"]')?.click()`)
  await waitFor(() => evaluate(`!!document.querySelector('.settings-layout')`), 'Backup Settings reopen')
  await selectSettingsPage(evaluate, 'Backup', '.backup-settings-list')
  await evaluate(`document.querySelector('.backup-settings-list .settings-list-row')?.click()`)
  await waitFor(
    () => evaluate(`!!document.querySelector('.backup-settings-detail')`),
    'existing Backup profile editor'
  )
  await editInput(client, 'Source 1', backupSource)
  await waitFor(
    async () => readJson(backupSettingsFile).profiles?.[0]?.mappings?.[0]?.source === backupSource,
    'updated Backup source persistence'
  )
  await editInput(client, 'Trash folder', backupTrash)
  await waitFor(
    async () => readJson(backupSettingsFile).profiles?.[0]?.trashPath === backupTrash,
    'Backup trash persistence'
  )
  await editInput(client, 'Log folder', backupLogs)
  await waitFor(
    async () => readJson(backupSettingsFile).profiles?.[0]?.logDirectory === backupLogs,
    'Backup log-directory persistence'
  )
  await editInput(client, 'Master log file', backupMasterLog)
  await waitFor(
    async () => {
      const profile = readJson(backupSettingsFile).profiles?.[0]
      return profile?.mappings?.[0]?.source === backupSource &&
        profile?.trashPath === backupTrash &&
        profile?.logDirectory === backupLogs &&
        profile?.masterLog === backupMasterLog
    },
    'complete Backup profile persistence'
  )
  await evaluate(`document.querySelector('.modal-close')?.click()`)
  await waitFor(() => evaluate(`!document.querySelector('.settings-layout')`), 'Backup Settings close')

  await evaluate(`document.querySelector('.backup-run')?.click()`)
  await waitFor(() => evaluate(`!!document.querySelector('.backup-status.is-done')`), 'packaged Backup mirror completion')
  if (fs.readFileSync(path.join(backupDestination, 'new.md'), 'utf8') !== 'new file' ||
      fs.readFileSync(path.join(backupDestination, 'changed.md'), 'utf8') !== 'new and longer contents' ||
      fs.existsSync(path.join(backupDestination, 'gone.md'))) {
    throw new Error('Backup native mirror did not produce the expected destination tree')
  }
  const backupStamps = fs.readdirSync(backupTrash).filter((name) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(name))
  if (backupStamps.length !== 1) throw new Error(`Expected one Backup archive, found ${backupStamps.join(', ')}`)
  const archiveRoot = path.join(backupTrash, backupStamps[0], path.basename(backupSource))
  if (fs.readFileSync(path.join(archiveRoot, 'changed.md'), 'utf8') !== 'old contents' ||
      fs.readFileSync(path.join(archiveRoot, 'gone.md'), 'utf8') !== 'deleted contents') {
    throw new Error('Backup did not escrow overwritten and deleted files')
  }
  const runLogs = fs.readdirSync(backupLogs)
  if (runLogs.join(',') !== `${backupStamps[0]}.log` ||
      !fs.readFileSync(path.join(backupLogs, runLogs[0]), 'utf8').includes('SESSION COMPLETE') ||
      !fs.readFileSync(backupMasterLog, 'utf8').includes('archived=2 errors=0')) {
    throw new Error('Backup did not write its configured run and master logs')
  }
  const backupRuns = await waitFor(
    async () => {
      const rows = await readDatasetRows(evaluate, 'backup.backup_runs')
      return rows.length === 1 ? rows : null
    },
    'packaged Backup history'
  )
  if (backupRuns[0].ok !== true) throw new Error('Backup history did not record the successful run')

  fs.writeFileSync(path.join(backupSource, 'changed.md'), 'locally divergent source contents')
  fs.rmSync(path.join(backupSource, 'new.md'))
  fs.writeFileSync(path.join(backupSource, 'source-only.md'), 'remove on restore')
  await evaluate(`document.querySelector('.backup-tab[aria-label="Archives"]')?.click()`)
  await waitFor(
    () => evaluate(`[...document.querySelectorAll('.backup-btn')].some((button) => button.textContent?.trim() === 'Restore…')`),
    'packaged Backup restore action'
  )
  await evaluate(`[...document.querySelectorAll('.backup-btn')]
    .find((button) => button.textContent?.trim() === 'Restore…')?.click()`)
  await waitFor(
    () => evaluate(`document.querySelector('.backup-card-text')?.textContent?.includes('add 1, update 1, remove 1')`),
    'packaged Backup restore preview'
  )
  if (fs.existsSync(path.join(backupSource, 'new.md')) ||
      fs.readFileSync(path.join(backupSource, 'changed.md'), 'utf8') !== 'locally divergent source contents' ||
      !fs.existsSync(path.join(backupSource, 'source-only.md'))) {
    throw new Error('Backup restore preview mutated the source tree')
  }
  await evaluate(`[...document.querySelectorAll('.backup-btn')]
    .find((button) => button.textContent?.trim() === 'Apply restore')?.click()`)
  await waitFor(
    () => evaluate(`[...document.querySelectorAll('.backup-note')].some((note) => note.textContent?.startsWith('Restored '))`),
    'packaged Backup restore apply'
  )
  if (fs.readFileSync(path.join(backupSource, 'new.md'), 'utf8') !== 'new file' ||
      fs.readFileSync(path.join(backupSource, 'changed.md'), 'utf8') !== 'new and longer contents' ||
      fs.existsSync(path.join(backupSource, 'source-only.md'))) {
    throw new Error('Backup restore apply did not reverse-mirror the destination')
  }
  const restoreEscrow = fs.readdirSync(backupTrash).find((name) => name.startsWith('restore-'))
  if (!restoreEscrow ||
      fs.readFileSync(path.join(backupTrash, restoreEscrow, 'changed.md'), 'utf8') !== 'locally divergent source contents' ||
      fs.readFileSync(path.join(backupTrash, restoreEscrow, 'source-only.md'), 'utf8') !== 'remove on restore') {
    throw new Error('Backup restore did not escrow overwritten and removed source files')
  }
  await evaluate(`[...document.querySelectorAll('.backup-btn')]
    .find((button) => button.textContent?.trim() === 'Clean up…')?.click()`)
  await waitFor(
    () => evaluate(`[...document.querySelectorAll('.backup-note')].some((note) => note.textContent?.startsWith('Nothing to remove'))`),
    'packaged Backup retention dry run'
  )
}
