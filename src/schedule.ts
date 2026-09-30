export type ScheduleEvery = 'off' | 'hourly' | 'daily' | 'weekly'

export interface Schedule {
  every: ScheduleEvery
  /** Local `HH:mm` for daily and weekly runs. */
  time: string
  /** 0 = Sunday … 6 = Saturday, for weekly runs. */
  weekday: number
  /** When this schedule was set (epoch ms). Slots before it were never missed. */
  since: number
}

export const DEFAULT_SCHEDULE: Schedule = { every: 'off', time: '02:00', weekday: 1, since: 0 }
const EVERY: readonly ScheduleEvery[] = ['off', 'hourly', 'daily', 'weekly']
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

export function parseSchedule(raw: unknown): Schedule {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {}
  const weekday = Number(value.weekday)
  const since = Number(value.since)
  return {
    every: EVERY.includes(value.every as ScheduleEvery) ? value.every as ScheduleEvery : DEFAULT_SCHEDULE.every,
    time: typeof value.time === 'string' && TIME.test(value.time) ? value.time : DEFAULT_SCHEDULE.time,
    weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : DEFAULT_SCHEDULE.weekday,
    since: Number.isFinite(since) && since > 0 ? since : 0
  }
}

/** A local date at the schedule's time of day. Setting the wall-clock fields
 *  (rather than adding milliseconds) keeps slots on time across DST changes. */
function atTime(base: Date, time: string): Date {
  const [, hours, minutes] = TIME.exec(time) ?? TIME.exec(DEFAULT_SCHEDULE.time)!
  const date = new Date(base)
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date
}

/** Start of the latest slot at or before `now`, or null when unscheduled. */
export function slotStart(schedule: Schedule, now: number): number | null {
  if (schedule.every === 'off') return null
  const current = new Date(now)
  if (schedule.every === 'hourly') {
    current.setMinutes(0, 0, 0)
    return current.getTime()
  }
  let slot = atTime(current, schedule.time)
  if (schedule.every === 'weekly') {
    slot.setDate(slot.getDate() - ((slot.getDay() - schedule.weekday + 7) % 7))
    slot = atTime(slot, schedule.time)
  }
  if (slot.getTime() > now) {
    slot.setDate(slot.getDate() - (schedule.every === 'weekly' ? 7 : 1))
    slot = atTime(slot, schedule.time)
  }
  return slot.getTime()
}

/** Start of the first slot after `now`, or null when unscheduled. */
export function nextSlot(schedule: Schedule, now: number): number | null {
  const current = slotStart(schedule, now)
  if (current === null) return null
  const next = new Date(current)
  if (schedule.every === 'hourly') {
    next.setHours(next.getHours() + 1)
    return next.getTime()
  }
  next.setDate(next.getDate() + (schedule.every === 'weekly' ? 7 : 1))
  return atTime(next, schedule.time).getTime()
}

export interface RunFacts {
  /** Latest successful run of the profile, whatever started it. */
  lastSuccessAt: number | null
  /** Latest scheduled attempt of the profile, successful or not. */
  lastScheduledAt: number | null
}

/**
 * Whether the current slot still owes a backup: it started after the schedule
 * was set, nothing succeeded since, and no scheduled attempt has claimed it. A
 * failed attempt is not retried until the next slot; a run that never started
 * (drive missing) is not an attempt, so it keeps being due.
 */
export function isDue(schedule: Schedule, facts: RunFacts, now: number): boolean {
  const slot = slotStart(schedule, now)
  if (slot === null || slot < schedule.since) return false
  if (facts.lastSuccessAt !== null && facts.lastSuccessAt >= slot) return false
  return facts.lastScheduledAt === null || facts.lastScheduledAt < slot
}

/** When the next scheduled backup is expected: `now` while one is due. */
export function nextRunAt(schedule: Schedule, facts: RunFacts, now: number): number | null {
  if (schedule.every === 'off') return null
  return isDue(schedule, facts, now) ? now : nextSlot(schedule, now)
}

/** Latest success and latest scheduled attempt of one profile, from history rows. */
export function runFacts(rows: ReadonlyArray<Record<string, unknown>>, profileId: string): RunFacts {
  let lastSuccessAt: number | null = null
  let lastScheduledAt: number | null = null
  for (const row of rows) {
    if (row.profileId !== profileId) continue
    const at = Date.parse(String(row.startedAt))
    if (Number.isNaN(at)) continue
    if ((row.ok === true || row.ok === 'true') && (lastSuccessAt === null || at > lastSuccessAt)) lastSuccessAt = at
    if (row.trigger === 'scheduled' && (lastScheduledAt === null || at > lastScheduledAt)) lastScheduledAt = at
  }
  return { lastSuccessAt, lastScheduledAt }
}
