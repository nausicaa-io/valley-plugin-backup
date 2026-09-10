# Backup

Create backup profiles for your Valley vault and configured folders, with live progress and a history of completed runs.

## Features

- Configure source and destination folders in separate backup profiles.
- Follow progress from the package’s sandboxed background engine.
- Review run history, duration, archived items, and errors.
- Keep profile settings and history in the vault when reinstalling the plugin.

## Install

Open **Settings → Plugins → GitHub**, click **+**, and enter:

`https://github.com/nausicaa-io/valley-plugin-backup`

Review the repository and plugin details, select **main**, and click **Install**. The repository includes the compiled plugin; installation does not require Git or npm.

## Use

Open **Settings → Backup** to configure a profile and its folder mappings. Select the profile in the Backup panel, review the destinations, and start a run. Check the reported result before relying on a backup.

## Requirements and updates

Requires Valley desktop 0.1.0 or later and plugin API v5. Use the GitHub plugin detail page to check for updates or explicitly apply another branch. Removing the installation preserves saved settings and history.

Backup owns its copy, restore, retention, history, and translation logic. Its sandboxed background engine uses generic SDK storage grants and dataset snapshots; Valley contains no Backup or mirror engine. Source and destination access require explicit grants, and resources are revoked when the plugin stops. Existing profiles, logs, and ordinary files retain their paths.

## Development

Use Node 24.19.0 and npm 11.17.0. Run `npm ci` and `npm run check` in this directory. The package owns its dependencies, tests, localization, and vendored SDK/tool/testkit archives; no Valley app checkout is required. `npm run check` validates imports, types, tests, and builds `runtime/index.js`. Commit rebuilt runtime files with source changes.

The package owns `locales/en.json`, `de.json`, `es.json`, `fr.json`, and `zh-CN.json`. Identity translations use `manifest.name` and `manifest.description`, including while disabled; fallback stays within the package’s English catalog. Authors and their URLs are paired arrays.
