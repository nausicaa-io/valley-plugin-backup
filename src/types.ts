export interface MirrorMapping {
  source: string
  destination: string
  exclude: string[]
}

export interface MirrorRetentionPolicy {
  keepDays: number
  dailies: number
  weeklies: number
}

export interface MirrorPlan {
  label: string
  mappings: MirrorMapping[]
  trashPath: string
  logDirectory: string
  masterLog: string
  retention: MirrorRetentionPolicy | null
}

/** A structured progress tick for the current mapping during a mirror run. */
export interface MirrorProgressUpdate {
  /** Folder name being mirrored (basename of the source). */
  folder: string
  /** 1-based index of the mapping currently running. */
  mappingIndex: number
  /** Total number of mappings in this run. */
  mappingCount: number
  /** Transfer percentage of the current mapping (0–100). */
  percent: number
  /** Estimated seconds left for the current mapping, or null while unknown. */
  etaSeconds: number | null
  /** `scanning` while mirror builds its file list; `transferring` once data moves. */
  phase: 'scanning' | 'transferring'
}

/** Result of one mapping during a mirror run (drives the friendly per-folder list). */
export interface MirrorMappingResult {
  /** 1-based index of the mapping. */
  index: number
  /** Folder name (basename of the source). */
  folder: string
  source: string
  destination: string
  status: 'running' | 'done' | 'failed' | 'skipped'
  /** Files moved to trash for this mapping (when `done`). */
  archived?: number
  /** Individual entries the engine could not handle (when `failed`). */
  failedItems?: number
  /** Friendly reason when skipped/failed. */
  message?: string
}

/** One streamed event from a running mirror: a log line, a progress tick, or a
 *  per-mapping status change. */
export interface MirrorProgress {
  line?: string
  update?: MirrorProgressUpdate
  mapping?: MirrorMappingResult
}

/** A reason a mirror can't run (or a folder was skipped), surfaced as a clear alert. */
export interface MirrorIssue {
  kind: 'no-mappings' | 'source-missing' | 'drive-not-mounted' | 'dest-error'
  /** 1-based mapping index this issue belongs to (absent for plan-level issues). */
  mappingIndex?: number
  folder?: string
  source?: string
  destination?: string
  /** Volume mount point that isn't mounted (for `drive-not-mounted`). */
  driveRoot?: string
  /** Human-readable, user-facing message. */
  message: string
}

/** Pre-flight validation of a mirror run: every source/destination reachable? */
export interface MirrorPreflight {
  ok: boolean
  issues: MirrorIssue[]
}

/** Summary of a finished (or failed) mirror run. */
export interface MirrorResult {
  /** True when every mapping completed without a mirror error. */
  ok: boolean
  /** Number of source→destination mappings processed. */
  mappings: number
  /** Files moved to the timestamped trash dir (mirror "backing up" lines). */
  archived: number
  /** Wall-clock duration of the run, in seconds. */
  durationSec: number
  /** Number of mappings that ended in an mirror/setup error. */
  errors: number
  /**
   * Individual entries that failed across every mapping. One unreadable file is
   * one of these and does not fail its folder, so `errors` (a folder count) can
   * read as a single error while thousands of items were left behind — which is
   * exactly how a mirror that could delete nothing looked healthy for a week.
   */
  failedItems?: number
  /** Human-readable reason when `ok` is false (no config, drive missing, …). */
  message?: string
  /** Blocking issues when the run was aborted by pre-flight. */
  issues?: MirrorIssue[]
}
