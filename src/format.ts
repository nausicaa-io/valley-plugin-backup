/** `95` → `1 min, 35 sec`, `40` → `40 sec`, in the app language. */
export function formatDuration(seconds: number, locale: string): string {
  const s = Math.max(0, Math.round(seconds))
  const unit = (value: number, name: 'hour' | 'minute' | 'second'): string =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'short' }).format(value)
  const list = (parts: string[]): string => new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(parts)
  if (s < 60) return unit(s, 'second')
  if (s < 3600) return list([unit(Math.floor(s / 60), 'minute'), unit(s % 60, 'second')])
  return list([unit(Math.floor(s / 3600), 'hour'), unit(Math.floor((s % 3600) / 60), 'minute')])
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const

/** `1536` → `1.5 kB`, in the app language. */
export function formatBytes(bytes: number, locale: string): string {
  let value = Math.max(0, bytes)
  let index = 0
  while (value >= 1000 && index < BYTE_UNITS.length - 1) {
    value /= 1000
    index++
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: BYTE_UNITS[index],
    unitDisplay: 'short',
    maximumFractionDigits: index === 0 || value >= 100 ? 0 : 1
  }).format(value)
}

export const formatCount = (value: number, locale: string): string => new Intl.NumberFormat(locale).format(value)

/** A future instant as "today 18:00", "tomorrow 02:00", "Monday 02:00" or a date. */
export function formatUpcoming(at: number, now: number, locale: string, hour12: boolean): string {
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12 }).format(at)
  const startOfDay = (value: number): number => new Date(value).setHours(0, 0, 0, 0)
  const days = Math.round((startOfDay(at) - startOfDay(now)) / 86_400_000)
  if (days <= 1) return `${new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.max(0, days), 'day')} ${time}`
  if (days < 7) return `${new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(at)} ${time}`
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', hour12 }).format(at)
}
