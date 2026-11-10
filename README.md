# Backup

Mirror your Valley realm and other folders to another drive on demand or on a schedule, with live progress, recoverable archives and a history of every run.

## Features

- Configure source and destination folders in separate backup profiles.
- Run a profile hourly, daily or weekly while Valley is open. A backup missed while the app was closed runs at the next launch, and one waiting for an unplugged drive starts once the drive is connected.
- Follow progress by items and bytes, and stop a running backup at any time. Files already copied or archived stay.
- Keep every changed or deleted file under a timestamp in the destination’s `.backup-archive` folder, or in a separate archive folder, and restore a folder from its backup with a preview first.
- Clean up old archives automatically: every archive for 7 days, then one per day for 30 days and one per week for 8 weeks.
- Review run history with copied, archived and failed items, including scheduled, stopped and interrupted runs.
- Keep profile settings in `config.json` and run history in `history.jsonl` under `.valley/plugins/data/backup/` when reinstalling the plugin.

## Install

Open **Settings → Plugins → GitHub**, click **+**, and enter:

`https://github.com/nausicaa-io/valley-plugin-backup`

Review the repository and plugin details, select **main**, and click **Install**. The repository includes the compiled plugin; installation does not require Git or npm.

## Use

Open **Settings → Backup** to configure a profile. Archive and log locations are optional; the first source/destination pair is ready to fill in, with **+ Add folder pair** below it for more folders. Select the profile in the Backup panel, review the destinations, and start a run. Check the reported result before relying on a backup.

Rename each folder pair using its name field. Add folder paths relative to Source and file patterns in **Exclude**, one rule at a time with Enter (for example `cache/` or `*.tmp`). Remove individual rules with ×.

The Backup panel shows every folder pair of the selected profile, each with a checkbox that includes it in runs and folder buttons that show its source and destination in the file manager; two option rows sit above them. Before a manual run, every ticked folder's source and destination must exist; a pair with a missing folder shows unticked and is skipped for that run, and its saved tick stays. Scheduled runs keep waiting for a missing drive. The first, **Keep deleted files**, moves changed and deleted destination files to the archive folder; turned off, they are removed permanently. The second, **Write log**, writes the run log and master log; turned off, neither is written.

A destination cannot sit inside its source, or the other way round, two pairs cannot share a destination, and system folders, home folders and whole drives are refused. Archive and log folders placed inside a source or destination are excluded from the mirror automatically. A run changes nothing in a folder pair when any folder cannot be read or when the source is empty while its backup is not.

## Requirements and updates

Requires Valley desktop 0.1.0 or later and plugin API v5. Use the GitHub plugin detail page to check for updates or explicitly apply another branch. Removing the installation preserves saved settings and history.

Backup owns its copy, restore, retention, history, and translation logic. Its sandboxed background engine uses generic SDK storage grants and dataset snapshots; Valley contains no Backup or mirror engine. Source and destination access require explicit grants, and resources are revoked when the plugin stops. Existing profiles, logs, and ordinary files retain their paths.

## Development

Use Node 24.19.0 and npm 11.17.0. Run `npm ci` and `npm run check` in this directory. The package owns its dependencies, tests, localization, and vendored SDK/tool/testkit archives; no Valley app checkout is required. `npm run check` validates imports, types, tests, and builds `runtime/index.js`. Commit rebuilt runtime files with source changes.

The package owns `locales/en.json`, `de.json`, `es.json`, `fr.json`, and `zh-CN.json`. Identity translations use `manifest.name` and `manifest.description`, including while disabled; fallback stays within the package’s English catalog. Authors and their URLs are paired arrays.

## Workflow integration

The backend explicitly registers its supported blocks through `registerWorkflowContribution`. Workflow calls the owning operations with their original authentication, cancellation, grants, revisions, and receipts. The catalogue publishes Draft-07 parameter and port contracts; credential administration and approval bypasses are excluded. Workflow availability is configured separately in Workflow → Plugins. Existing account, connection, and profile settings remain owned by this plugin.

Workflow output collections are explicit: `profile.list` → `$.profiles`, `profile.check` → `$.issues`. Selectors are relative to each execution item’s `json`. Profile checking deliberately exposes its complete findings array. Run receipts, prune results and restore plans contain optional or competing issues, dropped paths, errors, creates, updates, deletes and skipped paths, so they have no collection selector.
