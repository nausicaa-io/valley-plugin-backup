import type { PluginCommand, ValleyPluginApi } from '@valley/plugin-sdk'
import type { CommandSideEffect } from '@valley/plugin-sdk/commands'
const text = { type: 'string', maxLength: 1048576 }
const count = { type: 'integer', minimum: 0 }
const number = { type: 'number', minimum: 0 }
const boolean = { type: 'boolean' }
const object = (properties: Record<string, unknown>, required = Object.keys(properties)): Record<string, unknown> => ({ type: 'object', properties, required, additionalProperties: false })
const list = (items: Record<string, unknown>, maxItems = 10000): Record<string, unknown> => ({ type: 'array', items, maxItems })
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })
const strings = list(text)
const issue = object({ kind: { enum: ['no-mappings', 'source-missing', 'drive-not-mounted', 'overlap', 'dest-error'] }, mappingIndex: count, folder: text, source: text, destination: text, driveRoot: text, message: text }, ['kind', 'message'])
const mapping = object({ index: count, folder: text, source: text, destination: text, status: { enum: ['running', 'done', 'failed', 'skipped', 'stopped'] }, archived: count, failedItems: count, message: text }, ['index', 'folder', 'source', 'destination', 'status'])
const progress = object({ lines: strings, update: object({ folder: text, mappingIndex: count, mappingCount: count, percent: { type: 'number', minimum: 0, maximum: 100 }, etaSeconds: nullable(number), phase: { enum: ['scanning', 'transferring'] }, files: object({ done: count, total: count }), bytes: object({ done: count, total: count }) }, ['folder', 'mappingIndex', 'mappingCount', 'percent', 'etaSeconds', 'phase']), mapping }, [])
const profile = object({ id: text, name: text, mappings: list(object({ name: text, source: text, destination: text, exclude: strings }, ['source', 'destination', 'exclude'])), trashPath: text, logDirectory: text, masterLog: text, retention: { enum: ['standard', 'off'] }, schedule: object({ every: { enum: ['off', 'hourly', 'daily', 'weekly'] }, time: text, weekday: { type: 'integer', minimum: 0, maximum: 6 }, since: number }) })
const profiles = list(profile)
const preflight = object({ ok: boolean, issues: list(issue) })
const result = object({ cancelled: boolean, ok: boolean, mappings: count, archived: count, copied: count, bytes: count, durationSec: number, errors: count, failedItems: count, message: text, issues: list(issue) }, ['ok', 'mappings', 'archived', 'durationSec', 'errors'])
const prune = object({ cancelled: boolean, scanned: count, kept: count, dropped: strings, errors: list(object({ dir: text, message: text })) }, ['scanned', 'kept', 'dropped', 'errors'])
const restore = object({ cancelled: boolean, ok: boolean, message: text, skipped: strings, creates: strings, updates: strings, deletes: strings, escrowDir: text }, ['ok', 'creates', 'updates', 'deletes'])
export const backupResults: Record<string, Record<string, unknown>> = {
  status: object({ running: boolean, profileId: nullable(text), progress: nullable(progress), schedules: { type: 'object', maxProperties: 10000, additionalProperties: object({ nextAt: nullable(number), waiting: nullable(text) }) } }),
  stop: object({ stopped: boolean }), profiles, 'profile-read': profile, 'profile-create': profiles, 'profile-update': profiles, 'profile-delete': profiles,
  check: preflight, run: result, history: object({ rows: list({ type: 'object', properties: { id: text, startedAt: text }, required: ['id', 'startedAt'], maxProperties: 1000, additionalProperties: { type: ['string', 'number', 'boolean', 'null'] } }, 500), revision: count, nextCursor: text }, ['rows', 'revision']),
  'prune-preview': prune, prune, 'restore-preview': restore, restore
}

export const commandRegistrar = (api: Pick<ValleyPluginApi, 'commands'>) => <I = void, O = void, E extends CommandSideEffect = 'read'>(command: PluginCommand<I, O, E> & { outputSchema: Record<string, unknown> }): (() => void) => api.commands.register(command)
