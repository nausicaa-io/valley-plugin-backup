export class MirrorCancelled extends Error {
  constructor() { super('Backup operation cancelled') }
}

export class MirrorJobs {
  private disposed = false
  private readonly jobs = new Set<{ controller: AbortController; task: Promise<unknown> }>()
  private disposal?: Promise<void>

  run<T>(cancellation: AbortSignal | undefined, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.disposed || cancellation?.aborted) return Promise.reject(new MirrorCancelled())
    if (this.jobs.size >= 32) return Promise.reject(new Error('Too many pending backup operations'))
    const controller = new AbortController()
    const cancel = (): void => controller.abort()
    cancellation?.addEventListener('abort', cancel, { once: true })
    if (cancellation?.aborted) cancel()
    const task = Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new MirrorCancelled()
      return operation(controller.signal)
    }).finally(() => {
      cancellation?.removeEventListener('abort', cancel)
      this.jobs.delete(job)
    })
    const job = { controller, task }
    this.jobs.add(job)
    return task
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.disposed = true
    for (const job of this.jobs) job.controller.abort()
    return this.disposal = (async () => {
      await Promise.allSettled([...this.jobs].map((job) => job.task))
      this.jobs.clear()
    })()
  }
}
