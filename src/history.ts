import type { ValleyPluginApi } from '@valley/plugin-sdk'

export const HISTORY_FILE = 'history.jsonl'
type RecordValue = string | number | boolean | null
export type RunRecord = Record<string, RecordValue>

export class BackupClaimed extends Error {
  constructor() { super('This scheduled backup has already started') }
}

function parse(content: string): RunRecord[] {
  const ids = new Set<string>()
  return content.split('\n').filter(line => line.trim()).map(line => {
    const row = JSON.parse(line)
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.id !== 'string' || !row.id
      || typeof row.startedAt !== 'string' || !Number.isFinite(Date.parse(row.startedAt))
      || Object.values(row).some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value))
      || ids.has(row.id)) throw new Error('Invalid backup history')
    ids.add(row.id)
    return row
  })
}

export function subscribeHistory(api: ValleyPluginApi, listener: () => void): () => void {
  return api.data.files.onChanged(path => { if (path === HISTORY_FILE) listener() })
}

export function createHistoryStore(api: Pick<ValleyPluginApi, 'data'>, assertActive = (): void => {}) {
  const files = api.data.files
  const sorted = (rows: RunRecord[]): RunRecord[] => rows.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)) || String(a.id).localeCompare(String(b.id)))
  async function mutate(change: (rows: RunRecord[]) => RunRecord[]): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      assertActive()
      const current = await files.readTextBaseline(HISTORY_FILE)
      assertActive()
      const rows = change(parse(current?.content ?? ''))
      const content = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')
      const result = await files.writeTextGuarded(HISTORY_FILE, content, current?.baseline ?? null)
      if (result.ok) return
      if (result.reason !== 'conflict') throw new Error('Could not save backup history')
    }
    throw new Error('Backup history changed too often; try again')
  }
  return {
    async query(limit = 50, cursor?: string) {
      const offset = cursor === undefined ? 0 : Number(cursor)
      if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid history cursor')
      const rows = sorted(parse(await files.readText(HISTORY_FILE) ?? ''))
      return { rows: rows.slice(offset, offset + limit), revision: 0, ...(offset + limit < rows.length ? { nextCursor: String(offset + limit) } : {}) }
    },
    insert: (row: RunRecord) => mutate(rows => {
      if (rows.some(existing => existing.id === row.id)) throw new BackupClaimed()
      return [...rows, row]
    }),
    update: (id: string, values: RunRecord) => mutate(rows => {
      if (!rows.some(row => row.id === id)) throw new Error('Backup history entry is missing')
      return rows.map(row => row.id === id ? { ...row, ...values } : row)
    }),
    prune: (keep: number) => mutate(rows => sorted(rows).slice(0, keep)),
    /** Removes exactly the observed record and returns the stored rows before and after, for an exact inverse. */
    async remove(id: string, expected: RunRecord): Promise<{ before: RunRecord[]; after: RunRecord[] }> {
      let change!: { before: RunRecord[]; after: RunRecord[] }
      await mutate(rows => {
        const row = rows.find(existing => existing.id === id)
        if (!row || JSON.stringify(row) !== JSON.stringify(expected)) throw new Error('Backup history entry changed; read history again')
        change = { before: rows, after: rows.filter(existing => existing.id !== id) }
        return change.after
      })
      return change
    },
    replace: (expected: RunRecord[], next: RunRecord[]) => mutate(rows => {
      if (JSON.stringify(rows) !== JSON.stringify(expected)) throw new Error('Backup history changed after this operation')
      return next
    })
  }
}
