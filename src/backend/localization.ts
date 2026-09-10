import type { PluginBackendApi } from '@valley/plugin-sdk'
import en from '../../locales/en.json'

type Parameters = Record<string, string | number>
const english = (key: string, values: Parameters = {}): string => ((en as Record<string, string>)[key] ?? key).replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_match, name: string) => String(values[name] ?? ''))
let translate = english
export const t = (key: string, values?: Parameters): string => translate(key, values)
export function initBackendLocalization(i18n: PluginBackendApi['i18n']): () => void {
  translate = (key, values) => { const result = i18n.t(key, values); return result === key ? english(key, values) : result }
  return () => { translate = english }
}
