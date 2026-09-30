import { describe, expect, it } from 'vitest'
import { DEFAULT_SCHEDULE, isDue, nextRunAt, nextSlot, parseSchedule, runFacts, slotStart, type Schedule } from '../src/schedule'

const at = (y: number, mo: number, d: number, h = 0, mi = 0): number => new Date(y, mo - 1, d, h, mi).getTime()
const schedule = (patch: Partial<Schedule>): Schedule => ({ ...DEFAULT_SCHEDULE, since: at(2026, 1, 1), ...patch })
const never = { lastSuccessAt: null, lastScheduledAt: null }

describe('schedule slots', () => {
  it('places hourly slots on the hour', () => {
    const hourly = schedule({ every: 'hourly' })
    expect(slotStart(hourly, at(2026, 9, 24, 10, 40))).toBe(at(2026, 9, 24, 10))
    expect(nextSlot(hourly, at(2026, 9, 24, 10, 40))).toBe(at(2026, 9, 24, 11))
  })

  it('places daily slots at the chosen time, before and after it', () => {
    const daily = schedule({ every: 'daily', time: '02:30' })
    expect(slotStart(daily, at(2026, 9, 24, 1))).toBe(at(2026, 9, 23, 2, 30))
    expect(slotStart(daily, at(2026, 9, 24, 2, 30))).toBe(at(2026, 9, 24, 2, 30))
    expect(nextSlot(daily, at(2026, 9, 24, 3))).toBe(at(2026, 9, 25, 2, 30))
  })

  it('places weekly slots on the chosen weekday', () => {
    // 2026-09-24 is a Thursday; Monday = 1.
    const weekly = schedule({ every: 'weekly', weekday: 1, time: '20:00' })
    expect(slotStart(weekly, at(2026, 9, 24, 12))).toBe(at(2026, 9, 21, 20))
    expect(nextSlot(weekly, at(2026, 9, 24, 12))).toBe(at(2026, 9, 28, 20))
    expect(slotStart(weekly, at(2026, 9, 21, 19))).toBe(at(2026, 9, 14, 20))
  })

  it('keeps the wall-clock time across daylight-saving changes', () => {
    const daily = schedule({ every: 'daily', time: '09:00' })
    for (const day of [at(2026, 3, 28, 12), at(2026, 3, 29, 12), at(2026, 10, 24, 12), at(2026, 10, 25, 12)]) {
      const next = new Date(nextSlot(daily, day)!)
      expect([next.getHours(), next.getMinutes()]).toEqual([9, 0])
    }
  })

  it('is never scheduled when off', () => {
    expect(slotStart(DEFAULT_SCHEDULE, Date.now())).toBeNull()
    expect(nextRunAt(DEFAULT_SCHEDULE, never, Date.now())).toBeNull()
  })
})

describe('due backups', () => {
  const daily = schedule({ every: 'daily', time: '02:00' })
  const now = at(2026, 9, 24, 9)

  it('catches up a slot missed while Valley was closed', () => {
    expect(isDue(daily, { lastSuccessAt: at(2026, 9, 23, 2, 5), lastScheduledAt: at(2026, 9, 23, 2, 1) }, now)).toBe(true)
    expect(nextRunAt(daily, never, now)).toBe(now)
  })

  it('treats any successful run since the slot, even a manual one, as done', () => {
    const facts = { lastSuccessAt: at(2026, 9, 24, 8), lastScheduledAt: null }
    expect(isDue(daily, facts, now)).toBe(false)
    expect(nextRunAt(daily, facts, now)).toBe(at(2026, 9, 25, 2))
  })

  it('does not retry a failed scheduled attempt within the same slot', () => {
    expect(isDue(daily, { lastSuccessAt: null, lastScheduledAt: at(2026, 9, 24, 2, 1) }, now)).toBe(false)
    expect(isDue(daily, { lastSuccessAt: null, lastScheduledAt: at(2026, 9, 24, 2, 1) }, at(2026, 9, 25, 2, 1))).toBe(true)
  })

  it('never replays slots from before the schedule was set', () => {
    const fresh = { ...daily, since: at(2026, 9, 24, 8) }
    expect(isDue(fresh, never, now)).toBe(false)
    expect(nextRunAt(fresh, never, now)).toBe(at(2026, 9, 25, 2))
    expect(isDue(fresh, never, at(2026, 9, 25, 2))).toBe(true)
  })
})

describe('schedule parsing and history facts', () => {
  it('falls back to safe defaults for malformed settings', () => {
    expect(parseSchedule({ every: 'minutely', time: '25:00', weekday: 9, since: -1 })).toEqual(DEFAULT_SCHEDULE)
    expect(parseSchedule({ every: 'weekly', time: '07:15', weekday: 0, since: 5 })).toEqual({ every: 'weekly', time: '07:15', weekday: 0, since: 5 })
    expect(parseSchedule(undefined)).toEqual(DEFAULT_SCHEDULE)
  })

  it('reads the latest success and scheduled attempt of one profile', () => {
    const rows = [
      { profileId: 'a', startedAt: '2026-09-20T10:00:00.000Z', ok: true, trigger: 'manual' },
      { profileId: 'a', startedAt: '2026-09-22T10:00:00.000Z', ok: false, trigger: 'scheduled' },
      { profileId: 'a', startedAt: '2026-09-21T10:00:00.000Z', ok: 'true', trigger: 'scheduled' },
      { profileId: 'b', startedAt: '2026-09-23T10:00:00.000Z', ok: true, trigger: 'scheduled' },
      { profileName: 'legacy', startedAt: '2026-09-23T10:00:00.000Z', ok: true }
    ]
    expect(runFacts(rows, 'a')).toEqual({ lastSuccessAt: Date.parse('2026-09-21T10:00:00.000Z'), lastScheduledAt: Date.parse('2026-09-22T10:00:00.000Z') })
    expect(runFacts(rows, 'missing')).toEqual({ lastSuccessAt: null, lastScheduledAt: null })
  })
})
