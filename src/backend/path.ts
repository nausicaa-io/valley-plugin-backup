import { t } from './localization'
export const sep = '/'

export function normalize(value: string): string {
  const input = value.replace(/\\/g, '/')
  const prefix = input.match(/^[A-Za-z]:\//)?.[0] ?? (input.startsWith('//') ? '//' : input.startsWith('/') ? '/' : '')
  const parts: string[] = []
  for (const part of input.slice(prefix.length).split('/')) {
    if (!part || part === '.') continue
    if (part === '..') { if (parts.length && parts.at(-1) !== '..') parts.pop(); else if (!prefix) parts.push(part) }
    else parts.push(part)
  }
  return prefix + parts.join('/') || '.'
}
export const isAbsolute = (value: string): boolean => /^(?:[A-Za-z]:[\\/]|[\\/])/.test(value)
export const join = (...parts: string[]): string => normalize(parts.filter(Boolean).join('/'))
export function resolve(...parts: string[]): string {
  let result = ''
  for (const part of parts) result = isAbsolute(part) ? part : join(result, part)
  if (!isAbsolute(result)) throw new Error(t('backend.pathAbsolute'))
  return normalize(result)
}
export function dirname(value: string): string {
  const path = normalize(value)
  const at = path.lastIndexOf('/')
  return at === 0 ? '/' : at === 2 && /^[A-Za-z]:/.test(path) ? path.slice(0, 3) : at < 0 ? '.' : path.slice(0, at)
}
export const basename = (value: string): string => normalize(value).split('/').at(-1) ?? ''
export function relative(from: string, to: string): string {
  const start = normalize(from).split('/'), end = normalize(to).split('/')
  if (start[0].toLowerCase() !== end[0].toLowerCase()) return normalize(to)
  while (start.length && end.length && start[0] === end[0]) { start.shift(); end.shift() }
  return [...start.map(() => '..'), ...end].join('/')
}
