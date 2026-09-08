# Backup

Create backup profiles for your Valley vault and configured folders, with live progress and a history of completed runs.

## Features

- Configure source and destination folders in separate backup profiles.
- Follow progress while Valley's backup engine runs.
- Review run history, duration, archived items, and errors.
- Keep profile settings and history in the vault when reinstalling the plugin.

## Install

Open **Settings → Plugins → GitHub**, click **+**, and enter:

`https://github.com/nausicaa-io/valley-plugin-backup`

Review the repository and plugin details, select **main**, and click **Install**. The repository includes the compiled plugin; installation does not require Git or npm.

## Use

Open **Settings → Backup** to configure a profile and its folder mappings. Select the profile in the Backup panel, review the destinations, and start a run. Check the reported result before relying on a backup.

## Requirements and updates

Requires Valley desktop 0.1.0 or later and plugin API v4. Use the GitHub plugin detail page to check for updates or explicitly apply another branch. Removing the installation preserves saved settings and history.
