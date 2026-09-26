export const HANDOFF_PATH: string
export const HANDOFF_MAX_AGE_DAYS: number
export const WORKSPACE_FALLBACK_PATH: string

export function inferPartition(absolutePath: string): string
export function inferSection(input: { kind: string; lifecycle: string; partition: string }): 'core' | 'shared' | 'reference'

export interface ExtractedHandoffProject {
  id: string
  name: string
  partition: string
  path: string
  purpose: string
  stack: string
  status: string
  notes: string
  section: 'core' | 'shared' | 'reference'
  kind: string
  lifecycle: string
  verification: string
  handoffGeneratedAt: string | null
  handoffManifestPath: string | null
}

export function extractProjectsFromHandoff(snapshot: unknown, now?: Date): ExtractedHandoffProject[]

export interface HandoffSnapshotReadResult {
  snapshot: unknown
  ageMs: number | null
  ageDays: number | null
  stale: boolean
  error: Error | null
}

export function readHandoffSnapshot(options?: {
  handoffPath?: string
  maxAgeDays?: number
  now?: Date
}): Promise<HandoffSnapshotReadResult>
