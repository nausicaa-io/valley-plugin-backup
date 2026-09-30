import { mirrorPlan, serializeProfile, type Profile } from './profiles'
import type { MirrorPlan } from './types'

export type MaintenancePreview = {
  profileId: string
  revision: string
  plan: MirrorPlan
  mappingIndex?: number
  phase: 'preview' | 'ready' | 'applying'
}


export function createMaintenanceRegistry(ports: { isActive(): boolean; activeProfileId(): string; profile(id: string): Profile; assertClean(): void }) {
  const maintenanceOwners = new Set<ReturnType<typeof createMaintenanceOwner>>()
  function createMaintenanceOwner(onInvalidate: () => void) {
    let current: MaintenancePreview | undefined
    let closed = false
    let drained: Promise<void> | undefined
    const pending = new Map<Promise<unknown>, AbortController>()
    const isCurrent = (preview: MaintenancePreview): boolean => {
      if (closed || current !== preview || !ports.isActive() || ports.activeProfileId() !== preview.profileId) return false
      try {
        ports.assertClean()
        return JSON.stringify(serializeProfile(ports.profile(preview.profileId))) === preview.revision
      } catch { return false }
    }
    const invalidate = (): void => {
      const hadPreview = !!current
      current = undefined
      for (const controller of pending.values()) controller.abort()
      if (hadPreview && !closed) onInvalidate()
    }
    const owner = {
      isCurrent,
      revalidate: () => { if (current && !isCurrent(current)) invalidate() },
      begin: (profileId: string, forceRetention: boolean, mappingIndex?: number): MaintenancePreview | undefined => {
        if (closed || !ports.isActive()) return
        invalidate()
        try {
          ports.assertClean()
          const profile = ports.profile(profileId)
          const plan = mirrorPlan(profile, forceRetention)
          if (mappingIndex !== undefined && !plan.mappings[mappingIndex]) return
          current = { profileId: profile.id, revision: JSON.stringify(serializeProfile(profile)), plan, mappingIndex, phase: 'preview' }
          return current
        } catch { return }
      },
      ready: (preview: MaintenancePreview): boolean => {
        if (!isCurrent(preview)) return false
        preview.phase = 'ready'
        return true
      },
      confirm: (preview: MaintenancePreview): boolean => {
        if (!isCurrent(preview) || preview.phase !== 'ready') { owner.revalidate(); return false }
        preview.phase = 'applying'
        return true
      },
      cancel: (preview: MaintenancePreview) => { if (current === preview) invalidate() },
      run: <T,>(preview: MaintenancePreview, work: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
        const controller = new AbortController()
        const task = Promise.resolve().then(() => isCurrent(preview) && !controller.signal.aborted ? work(controller.signal) : undefined)
        pending.set(task, controller)
        const finish = (): void => { pending.delete(task) }
        void task.then(finish, finish)
        return task
      },
      dispose: (): Promise<void> => {
        if (drained) return drained
        closed = true
        invalidate()
        return drained = Promise.allSettled([...pending.keys()]).then(() => { maintenanceOwners.delete(owner) })
      }
    }
    maintenanceOwners.add(owner)
    return owner
  }
  return {
    createOwner: createMaintenanceOwner,
    revalidate: () => { for (const owner of maintenanceOwners) owner.revalidate() },
    dispose: () => Promise.allSettled([...maintenanceOwners].map(owner => owner.dispose())).then(() => {})
  }
}
