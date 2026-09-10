import { expect, it, vi } from 'vitest'
import type { PluginBackendApi } from '@valley/plugin-sdk'
import { initBackendLocalization } from '../src/backend/localization'
import { checkMirror } from '../src/backend/mirrorService'
import en from '../locales/en.json'
import de from '../locales/de.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import zhCN from '../locales/zh-CN.json'

vi.mock('../src/backend/storageFs', () => ({ storageFs: { access: async () => { throw new Error('Missing fixture') } } }))

it('switches backend errors through the package catalogs without reloading the engine', async () => {
  const catalogs: Record<string, Record<string, string>> = { en, de, es, fr, 'zh-CN': zhCN }
  let language = 'en'
  const dispose = initBackendLocalization({
    language: () => language,
    onLanguageChanged: () => () => {},
    t: (key, values) => (catalogs[language][key] ?? key).replace(/\{\{([^}]+)\}\}/g, (_match, name: string) => String(values?.[name] ?? ''))
  } as PluginBackendApi['i18n'])
  const plan = { label: 'Fixture', mappings: [{ source: '/fixture/Blüten', destination: '/fixture/destination', exclude: [] }], trashPath: '', logDirectory: '', masterLog: '', retention: null }
  try {
    for (const [locale, expected] of Object.entries({ en: 'Source folder is missing', de: 'Quellordner fehlt', es: 'Falta la carpeta de origen', fr: 'Le dossier source est introuvable', 'zh-CN': '来源文件夹不存在' })) {
      language = locale
      const result = await checkMirror(plan)
      expect(result.ok).toBe(false)
      expect(result.issues[0].message).toBe(expected + (locale === 'fr' ? ' : ' : locale === 'zh-CN' ? '：' : ': ') + plan.mappings[0].source)
      expect(result.issues[0].message).not.toContain('�')
    }
  } finally { dispose() }
  expect((await checkMirror(plan)).issues[0].message).toMatch(/^Source folder is missing/)
})
