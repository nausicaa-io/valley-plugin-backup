import Ajv from 'ajv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { METADATA_PANEL_SEGMENT_V1, PLUGIN_SURFACE_V1 } from '@valley/plugin-sdk'
import type { ValleyPluginManifest } from '@valley/plugin-sdk/types'
import { createMockValleyApi } from '@valley/plugin-testkit'

const packages = [['backup', () => import('../src/index'), () => import('../manifest.json'), () => import('../config.json')]] as const

describe('plugin automation source catalog', () => {
  const createObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  beforeAll(() => { Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:catalog-test' }) })
  afterAll(() => {
    if (createObjectURL) Object.defineProperty(URL, 'createObjectURL', createObjectURL)
    else Reflect.deleteProperty(URL, 'createObjectURL')
  })
  it.each(packages)('%s declares input schemas and main-content-only Properties', async (id, module, manifest, config) => {
    const [plugin, metadata, configuration] = await Promise.all([module(), manifest(), config()])
    const declared = { ...metadata.default, ...configuration.default } as unknown as ValleyPluginManifest
    const mock = createMockValleyApi({ manifest: declared, settings: { profiles: [] }, indexEntries: [{ relPath: 'Unrelated.md', title: 'Unrelated', kind: 'note', mtimeMs: 1 }] })
    const observe = vi.spyOn(mock.api.index, 'observe')
    const registrations = vi.spyOn(mock.api.commands, 'register')
    expect(mock.api.getState().indexEntries).toEqual([])
    const dispose = plugin.register(mock.api)
    try {
      await Promise.resolve()
      const commands = mock.api.commands.list()
      expect(commands.length, `${id} did not register its commands`).toBeGreaterThan(0)
      expect(commands.filter((command) => command.acceptsInput && !command.inputSchema).map((command) => command.id)).toEqual([])
      const validate = new Ajv({ strict: false, allowUnionTypes: true })
      for (const [registered] of registrations.mock.calls) {
        const specification = registered as typeof registered & { outputSchema?: Record<string, unknown> }
        expect(specification.outputSchema, specification.id).toBeDefined()
        validate.compile(specification.outputSchema!)
      }
      for (const id of ['status', 'profiles', 'history']) {
        const response = await mock.api.commands.execute(`backup:${id}`, {})
        expect(response.ok, id).toBe(true)
        const registered = registrations.mock.calls.find(([entry]) => entry.id === id)![0]
        const specification = registered as typeof registered & { outputSchema?: Record<string, unknown> }
        if (!response.ok) throw new Error(`Command failed: ${id}`)
        expect(validate.compile(specification.outputSchema!)(response.value), id).toBe(true)
      }
      const baseline = JSON.stringify(mock.api.settings.get())
      const invoke = async (id: string, input: unknown) => {
        const response = await mock.api.commands.execute(`backup:${id}`, input)
        expect(response.ok, id).toBe(true)
        if (!response.ok) throw new Error(`Command failed: ${id}`)
        const registered = registrations.mock.calls.find(([entry]) => entry.id === id)![0]
        const specification = registered as typeof registered & { outputSchema: Record<string, unknown> }
        expect(validate.validate(specification.outputSchema, response.value), JSON.stringify(validate.errors)).toBe(true)
        return response.value
      }
      const created = await invoke('profile-create', { name: 'Disposable', mappings: [], trashPath: '', logDirectory: '', masterLog: '', retention: 'off', schedule: { every: 'off', time: '00:00', weekday: 0 } }) as Array<{ id: string }>
      const profileId = created[0].id
      await invoke('profile-read', { profileId })
      await invoke('profile-update', { profileId, values: { name: 'Changed', mappings: [], trashPath: '', schedule: { weekday: 0 } } })
      expect((mock.api.settings.get().profiles as Array<{ name: string }>)[0].name).toBe('Changed')
      expect(await invoke('profile-delete', { profileId })).toEqual([])
      for (const entry of [...mock.busUndo].reverse()) await entry.undo()
      expect(JSON.stringify(mock.api.settings.get())).toBe(baseline)
      expect(commands.every((command) => command.pluginId === id && command.id.startsWith(`${id}:`))).toBe(true)
      const properties = mock.api.interop.extensions.providers(METADATA_PANEL_SEGMENT_V1)
      const declaredExtensions = (declared.provides ?? []).filter((contract) => contract.kind === 'extension').map((contract) => contract.id)
      expect(declaredExtensions).not.toContain(METADATA_PANEL_SEGMENT_V1.id)
      expect(properties).toEqual([])
      expect(declaredExtensions).toContain(PLUGIN_SURFACE_V1.id)
      for (const { extension } of properties) {
        expect(extension.pluginSurfaces === undefined || extension.pluginSurfaces.every((surface) => surface === 'main_workspace')).toBe(true)
        expect(extension.inspect, `${id}:${extension.id} is missing machine-readable Properties`).toBeTypeOf('function')
        if (extension.editCommand) {
          expect(extension.editCommand).not.toContain(':')
          expect(commands.find((command) => command.id === `${id}:${extension.editCommand}`), extension.editCommand).toMatchObject({ pluginId: id, sideEffect: 'write' })
        }
      }
      const providers = mock.api.interop.extensions.providers(PLUGIN_SURFACE_V1)
      const snapshots = providers.map(({ extension }) => extension.getSnapshot())
      mock.emitState({ indexEntries: [{ relPath: 'Changed.md', title: 'Changed', kind: 'note', mtimeMs: 2 }] })
      expect(mock.api.getState().indexEntries).toEqual([])
      expect(providers.map(({ extension }) => extension.getSnapshot())).toEqual(snapshots)
      expect(observe).not.toHaveBeenCalled()
      const surfaces = providers.map(({ extension }) => extension.surface)
      for (const surface of Object.keys(declared.uiSlots ?? {})) expect(surfaces, `${id}:${surface}`).toContain(surface)
      if (Object.keys(declared.fileViews ?? {}).length) expect(surfaces).toContain('main_workspace')
      if (properties.some(({ extension }) => extension.pluginSurfaces?.includes('main_workspace'))) expect(surfaces).toContain('main_workspace')
      expect(new Set(commands.map((command) => command.id)).size).toBe(commands.length)
      const backendIds = (configuration.default.runtime.services as Array<{ metadata?: { command?: { id: string }; commands?: Array<{ id: string }> } }>).flatMap((service) => service.metadata?.commands ?? (service.metadata?.command ? [service.metadata.command] : [])).map((command) => command.id)
      expect(backendIds.length).toBeGreaterThan(0)
      expect(registrations.mock.calls.map(([entry]) => entry.id).filter((local) => backendIds.includes(local)), 'frontend commands shadowed by backend command services').toEqual([])
    } finally { dispose() }
  })
  it('guards the profile-based run and prune commands in every preset like their backend counterparts', async () => {
    const configuration = (await import('../config.json')).default as unknown as { guardPresets: { presets: Array<{ id: string; version: number; entries: { commands: Record<string, { decision: string; allowPreApproval?: boolean }> } }> } }
    const expected: Record<string, { decision: string; allowPreApproval?: boolean }> = { recommended: { decision: 'confirm', allowPreApproval: false }, 'read-only': { decision: 'deny' }, blocked: { decision: 'deny' } }
    expect(configuration.guardPresets.presets.map((preset) => preset.id).sort()).toEqual(Object.keys(expected).sort())
    for (const preset of configuration.guardPresets.presets) {
      expect(preset.version, preset.id).toBeGreaterThanOrEqual(4)
      for (const [backend, frontend] of [['run', 'profile-run'], ['prune', 'profile-prune']]) {
        expect(preset.entries.commands[backend], `${preset.id}:${backend}`).toEqual(expected[preset.id])
        expect(preset.entries.commands[frontend], `${preset.id}:${frontend}`).toEqual(preset.entries.commands[backend])
      }
    }
  })
  it('names every backup write in each preset: read-only and blocked deny them, blocked denies reads too', async () => {
    const [plugin, metadata, configuration] = await Promise.all([import('../src/index'), import('../manifest.json'), import('../config.json')])
    const config = configuration.default as unknown as { guardPresets: { presets: Array<{ id: string; entries: { commands: Record<string, { decision: string; allowPreApproval?: boolean }> } }> }; runtime: { services: Array<{ metadata?: { command?: { id: string; effect: string } } }> } }
    const declared = { ...metadata.default, ...configuration.default } as unknown as ValleyPluginManifest
    const mock = createMockValleyApi({ manifest: declared, settings: { profiles: [] } })
    const registrations = vi.spyOn(mock.api.commands, 'register')
    const dispose = plugin.register(mock.api)
    try {
      await Promise.resolve()
      const frontend = registrations.mock.calls.map(([entry]) => entry as { id: string; sideEffect?: string })
      const backend = config.runtime.services.flatMap((service) => service.metadata?.command ? [service.metadata.command] : [])
      const writes = [...frontend.filter((entry) => entry.sideEffect === 'write').map((entry) => entry.id), ...backend.filter((entry) => entry.effect !== 'read').map((entry) => entry.id)]
      const reads = [...frontend.filter((entry) => entry.sideEffect !== 'write').map((entry) => entry.id), ...backend.filter((entry) => entry.effect === 'read').map((entry) => entry.id)]
      expect(writes).toEqual(expect.arrayContaining(['restore', 'restoreApply', 'profile-create', 'profile-update', 'profile-delete']))
      const presets = Object.fromEntries(config.guardPresets.presets.map((preset) => [preset.id, preset.entries.commands]))
      for (const id of writes) {
        expect(presets['read-only'][id], `read-only:${id}`).toEqual({ decision: 'deny' })
        expect(presets.blocked[id], `blocked:${id}`).toEqual({ decision: 'deny' })
      }
      for (const id of reads) expect(presets.blocked[id], `blocked:${id}`).toEqual({ decision: 'deny' })
      for (const id of ['run', 'profile-run', 'prune', 'profile-prune', 'restore', 'restoreApply']) expect(presets.recommended[id], `recommended:${id}`).toEqual({ decision: 'confirm', allowPreApproval: false })
    } finally { dispose() }
  })
})
