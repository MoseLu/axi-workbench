/**
 * Commit Ledger API Handlers (TypeScript)
 *
 * HTTP request handlers for Commit Ledger API endpoints
 * Uses persistence.ts and evidence-linker.ts for data access
 *
 * @module api-handlers
 */

import {
  CommitLedgerStore,
  getStore,
  CommitLedgerV1,
  QueryFilter,
  Pagination,
  QueryResult
} from './persistence.js';
import {
  getVerificationStats,
  detectConflicts,
  detectStale,
  linkEvidenceBatch,
  VerificationStatus,
  VerificationStats,
  Conflict,
  StaleRecord,
  LedgerRecord
} from './evidence-linker.js';
import { collectAll } from './collector.js';

// Re-export types for consumers
export type { CommitLedgerV1, QueryFilter, Pagination, QueryResult } from './persistence.js';
export type { VerificationStats, Conflict, StaleRecord, VerificationStatus, LedgerRecord } from './evidence-linker.js';

// ============================================================================
// Local Type Projections (commit-ledger domain)
// ============================================================================

/**
 * Minimal subset of `CommitLedgerV1.repo` referenced by API projections.
 * Matches the `repo` shape in `persistence.ts` but is declared here so we
 * never reach for `as any` when the storage schema adds optional fields.
 */
export interface RepoSummary {
  projectId: string;
  canonicalPath: string;
  gitRoot: string;
  defaultBranch: string;
  remote?: string;
  partition?: string;
}

/**
 * Minimal subset of `CommitLedgerV1.commit` used by ordering and summary
 * computations.
 */
export interface CommitSummary {
  sha: string;
  shortSha: string;
  parentShas: string[];
  subject: string;
  body?: string;
  type?: string;
  scope?: string | null;
  breaking?: boolean;
  authoredAt: string;
  committedAt: string;
}

/**
 * Minimal subset of `CommitLedgerV1.workspaceState` referenced by API
 * projections.
 */
export interface WorkspaceStateSummary {
  observedBranch?: string;
  isDirty?: boolean;
  ahead?: number;
  behind?: number;
  observedAt?: string;
}

/**
 * Minimal subset of `CommitLedgerV1.verification` referenced by API
 * projections.
 */
export interface VerificationSummary {
  status?: VerificationStatus;
  commands?: string[];
  evidenceRefs?: string[];
  observedAt?: string;
}

/**
 * Minimal subset of `CommitLedgerV1.provenance` referenced by API
 * projections.
 */
export interface ProvenanceSummary {
  source: string;
  sourcePath: string;
  sourceCommand?: string;
  sourceHash?: string;
  observedAt: string;
}

/**
 * Minimal subset of `CommitLedgerV1.ingestion` referenced by API
 * projections.
 */
export interface IngestionSummary {
  idempotencyKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: 'new' | 'updated' | 'unchanged' | 'conflict';
}

/**
 * Commit-ledger record projection used by API handlers. The full record is
 * defined in `persistence.ts`; this view is the union of every nested shape
 * the handlers read from. When persistence adds new fields they should be
 * appended here so call sites stay type-safe.
 */
export type CommitLedgerRecord = CommitLedgerV1;

/**
 * Strongly-typed commit-ledger query filter. Mirrors `QueryFilter` from
 * `persistence.ts` so handlers never need `any` when building a query.
 */
export type CommitLedgerFilter = QueryFilter;

/**
 * Common read projection used by every accessor helper below. Both
 * `CommitLedgerV1` (storage) and `LedgerRecord` (linker) carry the same
 * sub-fields; we accept a union so handlers can stay agnostic about
 * whether a record came from the store or the evidence linker.
 */
type AnyLedgerRecord = CommitLedgerV1 | LedgerRecord;

/**
 * Type-safe nested-field reader. Reads via an `unknown` indirection so we
 * never need `as any` to traverse the union's overlapping sub-fields.
 */
function readField<T>(record: AnyLedgerRecord, key: keyof AnyLedgerRecord): T | undefined {
  const value = (record as unknown as Record<string, unknown>)[key];
  return (value ?? undefined) as T | undefined;
}

/**
 * Type guard: narrows `LedgerRecord | CommitLedgerV1` to a value that has
 * the `repo` projection populated. Used to avoid `as any` when downstream
 * APIs require the full domain shape.
 */
function asRepo(record: AnyLedgerRecord): RepoSummary | undefined {
  return readField<RepoSummary>(record, 'repo');
}

function asCommit(record: AnyLedgerRecord): CommitSummary | undefined {
  return readField<CommitSummary>(record, 'commit');
}

function asWorkspaceState(record: AnyLedgerRecord): WorkspaceStateSummary | undefined {
  return readField<WorkspaceStateSummary>(record, 'workspaceState');
}

function asVerification(record: AnyLedgerRecord): VerificationSummary | undefined {
  return readField<VerificationSummary>(record, 'verification');
}

function asProvenance(record: AnyLedgerRecord): ProvenanceSummary | undefined {
  return readField<ProvenanceSummary>(record, 'provenance');
}

function asIngestion(record: AnyLedgerRecord): IngestionSummary | undefined {
  return readField<IngestionSummary>(record, 'ingestion');
}

// ============================================================================
// Handler Context
// ============================================================================

export interface HandlerContext {
  store: CommitLedgerStore;
}

let defaultContext: HandlerContext | null = null;

/**
 * Get or create default handler context
 */
export function getContext(): HandlerContext {
  if (!defaultContext) {
    defaultContext = {
      store: getStore()
    };
  }
  return defaultContext;
}

/**
 * Initialize context with store
 */
export function initContext(store: CommitLedgerStore): HandlerContext {
  defaultContext = { store };
  return defaultContext;
}

// ============================================================================
// Query Types
// ============================================================================

export interface CommitQuery {
  projectId?: string;
  partition?: string;
  branch?: string;
  author?: string;
  type?: string;
  scope?: string;
  dateFrom?: string;
  dateTo?: string;
  verificationStatus?: string;
  dirty?: boolean;
}

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
  sortBy?: 'committedAt' | 'verificationStatus';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface SummaryResponse {
  workspace: {
    totalProjects: number;
    totalCommits: number;
    lastCommitAt: string | null;
    verifiedCommits: number;
    partialCommits: number;
    unverifiedCommits: number;
    failedCommits: number;
    dirtyWorkspaces: number;
    conflictRecords: number;
    failedSources: number;
  };
  byPartition: Record<string, { repos: number; commits: number }>;
  verification: {
    verified: number;
    partial: number;
    unverified: number;
    failed: number;
    conflict: number;
    unknown: number;
  };
  generatedAt: string;
}

export interface ProjectSummary {
  id: string;
  canonicalPath: string | null;
  partition: string | null;
  branch: string | null;
  head: string | null;
  isDirty: boolean;
  commitCount: number;
  lastCommitAt: string | null;
  verification: {
    verified: number;
    partial: number;
    unverified: number;
    failed: number;
    conflict: number;
    unknown: number;
  };
  coverage: number;
}

export interface SourceInfo {
  repoId: string | null;
  path: string;
  lastSeenAt: string | null;
  commitCount: number;
  status: 'active' | 'failed' | 'stale';
  lastError?: string;
}

export interface SyncResult {
  ok: boolean;
  jobId: string;
  synced: {
    new: number;
    updated: number;
    unchanged: number;
    conflict: number;
    failed: number;
  };
  summary: {
    totalRepos: number;
    successfulRepos: number;
    failedRepos: number;
    totalCommits: number;
  };
  syncedAt: string;
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * GET /api/v1/commit-ledger/summary
 *
 * Returns workspace-wide summary statistics
 */
export function handleGetSummary(ctx: HandlerContext = getContext()): SummaryResponse {
  const records: LedgerRecord[] = ctx.store.getAllRecords();

  // Count by partition
  const byPartition: Record<string, { repos: number; commits: number }> = {};
  const partitions = ['projects', 'products', 'shared', 'infra', 'tools'];

  for (const p of partitions) {
    const partitionRecords = records.filter(r => asRepo(r)?.partition === p);
    byPartition[p] = {
      repos: new Set(partitionRecords.map(r => asRepo(r)?.projectId).filter((id): id is string => Boolean(id))).size,
      commits: partitionRecords.length
    };
  }

  // Verification stats
  const verification = getVerificationStats(records);

  // Dirty workspaces
  const dirtyWorkspaces = records.filter(r => asWorkspaceState(r)?.isDirty === true).length;

  // Conflicts
  const conflicts = detectConflicts(records);

  // Find last commit
  let lastCommitAt: string | null = null;
  if (records.length > 0) {
    const sorted = [...records].sort((a, b) =>
      new Date(asCommit(b)?.committedAt || 0).getTime() -
      new Date(asCommit(a)?.committedAt || 0).getTime()
    );
    lastCommitAt = asCommit(sorted[0])?.committedAt || null;
  }

  // Count unique projects
  const totalProjects = new Set(
    records
      .map(r => asRepo(r)?.projectId)
      .filter((id): id is string => Boolean(id))
  ).size;

  return {
    workspace: {
      totalProjects,
      totalCommits: records.length,
      lastCommitAt,
      verifiedCommits: verification.verified,
      partialCommits: verification.partial,
      unverifiedCommits: verification.unverified,
      failedCommits: verification.failed,
      dirtyWorkspaces,
      conflictRecords: conflicts.length,
      failedSources: 0  // Would require source health tracking
    },
    byPartition,
    verification,
    generatedAt: new Date().toISOString()
  };
}

/**
 * GET /api/v1/commit-ledger/commits
 *
 * Query commits with filtering and pagination
 */
export function handleGetCommits(
  query: CommitQuery,
  pagination: PaginationOptions = {},
  ctx: HandlerContext = getContext()
): PaginatedResult<CommitLedgerRecord> {
  // Build filter object for persistence layer
  const filter: CommitLedgerFilter = {};

  if (query.projectId) filter.projectId = query.projectId;
  if (query.partition) filter.partition = query.partition;
  if (query.branch) filter.branch = query.branch;
  if (query.author) filter.author = query.author;
  if (query.type) filter.type = query.type;
  if (query.scope) filter.scope = query.scope;
  if (query.dateFrom) filter.dateFrom = query.dateFrom;
  if (query.dateTo) filter.dateTo = query.dateTo;
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
  if (query.dirty !== undefined) filter.dirty = query.dirty;

  // Build pagination options
  const pageOptions: Pagination = {
    cursor: pagination.cursor,
    limit: Math.min(pagination.limit || 50, 100),
    sortBy: pagination.sortBy || 'committedAt',
    sortOrder: pagination.sortOrder || 'desc'
  };

  const result: QueryResult = ctx.store.query(filter, pageOptions);

  return {
    data: result.data,
    pagination: {
      nextCursor: result.pagination.nextCursor,
      hasMore: result.pagination.hasMore,
      total: result.pagination.total
    }
  };
}

/**
 * GET /api/v1/commit-ledger/commits/:recordId
 *
 * Get single commit record by ID
 */
export function handleGetCommitById(
  recordId: string,
  ctx: HandlerContext = getContext()
): { data: LedgerRecord } | { error: { code: string; message: string; recordId: string } } {
  const record: CommitLedgerV1 | null = ctx.store.getById(recordId);

  if (!record) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'Commit record not found',
        recordId
      }
    };
  }

  // Enhance with evidence linking. `CommitLedgerV1` is structurally a stricter
  // `LedgerRecord`, so the assignment is safe and required by the linker
  // signature (linker accepts the wider optional shape).
  const ledgerRecord: LedgerRecord = record;
  const linked = linkEvidenceBatch([ledgerRecord]);

  return { data: linked[0] };
}

/**
 * GET /api/v1/commit-ledger/projects/:projectId
 *
 * Get project-specific commit statistics
 */
export function handleGetProject(
  projectId: string,
  ctx: HandlerContext = getContext()
): { data: ProjectSummary } | { error: { code: string; message: string; projectId: string } } {
  const result: QueryResult = ctx.store.query({ projectId }, { limit: 10000 });
  const records: LedgerRecord[] = result.data as LedgerRecord[];

  if (records.length === 0) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'Project not found or has no commits',
        projectId
      }
    };
  }

  const verification = getVerificationStats(records);

  // Find latest commit
  const sorted = [...records].sort((a, b) =>
    new Date(asCommit(b)?.committedAt || 0).getTime() -
    new Date(asCommit(a)?.committedAt || 0).getTime()
  );
  const latest: LedgerRecord = sorted[0];
  const latestRepo = asRepo(latest);
  const latestWorkspaceState = asWorkspaceState(latest);
  const latestCommit = asCommit(latest);

  // Calculate coverage
  const coverage = records.length > 0
    ? Number(((verification.verified + verification.partial) / records.length).toFixed(2))
    : 0;

  return {
    data: {
      id: projectId,
      canonicalPath: latestRepo?.canonicalPath || null,
      partition: latestRepo?.partition || null,
      branch: latestWorkspaceState?.observedBranch || null,
      head: latestCommit?.shortSha || null,
      isDirty: latestWorkspaceState?.isDirty || false,
      commitCount: records.length,
      lastCommitAt: latestCommit?.committedAt || null,
      verification,
      coverage
    }
  };
}

/**
 * GET /api/v1/commit-ledger/verification
 *
 * Get verification statistics and status
 */
export function handleGetVerification(
  ctx: HandlerContext = getContext()
): {
  status: VerificationStats;
  byProject: Array<{
    projectId: string;
    verified: number;
    partial: number;
    unverified: number;
    failed: number;
    conflict: number;
    unknown: number;
    total: number;
    coverage: number;
  }>;
  staleRecords: Array<{
    recordId: string;
    sha?: string;
    projectId?: string;
    verifiedAt?: string;
    staleDays: number;
  }>;
} {
  const records: LedgerRecord[] = ctx.store.getAllRecords();
  const status = getVerificationStats(records);

  // Group by project
  type ProjectBucket = {
    projectId: string;
    verified: number;
    partial: number;
    unverified: number;
    failed: number;
    conflict: number;
    unknown: number;
    total: number;
  };
  const byProjectMap: Record<string, ProjectBucket> = {};

  for (const record of records) {
    const pid: string = asRepo(record)?.projectId || 'unknown';
    if (!byProjectMap[pid]) {
      byProjectMap[pid] = {
        projectId: pid,
        verified: 0,
        partial: 0,
        unverified: 0,
        failed: 0,
        conflict: 0,
        unknown: 0,
        total: 0
      };
    }
    byProjectMap[pid].total++;
    const recStatus = asVerification(record)?.status || VerificationStatus.UNKNOWN;
    if (recStatus in byProjectMap[pid]) {
      const key = recStatus as keyof ProjectBucket;
      byProjectMap[pid][key]++;
    }
  }

  // Calculate coverage per project
  const byProject = Object.values(byProjectMap).map((p) => ({
    ...p,
    coverage: p.total > 0
      ? Number(((p.verified + p.partial) / p.total).toFixed(2))
      : 0
  }));

  // Detect stale records
  const staleRecords = detectStale(records);

  return {
    status,
    byProject,
    staleRecords
  };
}

/**
 * GET /api/v1/commit-ledger/sources
 *
 * Get source repository status
 */
export function handleGetSources(
  ctx: HandlerContext = getContext()
): {
  sources: SourceInfo[];
  total: number;
  failedSources: number;
} {
  const records: LedgerRecord[] = ctx.store.getAllRecords();

  // Group by source path
  const sourceMap: Map<string, SourceInfo> = new Map();

  for (const record of records) {
    const path = asProvenance(record)?.sourcePath || asRepo(record)?.canonicalPath || 'unknown';
    const repoId = asRepo(record)?.projectId || null;

    if (!sourceMap.has(path)) {
      sourceMap.set(path, {
        repoId,
        path,
        lastSeenAt: asIngestion(record)?.lastSeenAt || null,
        commitCount: 0,
        status: 'active'
      });
    }

    const source = sourceMap.get(path)!;
    source.commitCount++;

    // Update last seen
    const recordLastSeen = asIngestion(record)?.lastSeenAt;
    if (recordLastSeen && (!source.lastSeenAt || recordLastSeen > source.lastSeenAt)) {
      source.lastSeenAt = recordLastSeen;
    }
  }

  const sources = Array.from(sourceMap.values());

  return {
    sources,
    total: sources.length,
    failedSources: sources.filter(s => s.status === 'failed').length
  };
}

/**
 * POST /api/v1/commit-ledger/sync
 *
 * Trigger incremental sync of all repositories
 */
export async function handleSync(
  ctx: HandlerContext = getContext()
): Promise<SyncResult> {
  // Ensure storage is initialized
  ctx.store.ensureStorage();

  // Collect commits from all repos
  const collectResult = collectAll({});

  // Link evidence to new records. The collector returns CommitRecord shapes
  // that are already LedgerRecord-compatible; we route them through a typed
  // local view so the conversion stays explicit and typed.
  type CollectEntry = { commits: LedgerRecord[] };
  const allNewRecords: LedgerRecord[] = collectResult.results.flatMap(
    (r: CollectEntry) => r.commits
  );
  const linkedRecords: LedgerRecord[] = linkEvidenceBatch(allNewRecords);

  // Upsert each record
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let conflictCount = 0;

  for (const record of linkedRecords) {
    const result = ctx.store.upsert(record);
    switch (result.status) {
      case 'new':
        newCount++;
        break;
      case 'updated':
        updatedCount++;
        break;
      case 'unchanged':
        unchangedCount++;
        break;
      case 'conflict':
        conflictCount++;
        break;
    }
  }

  const jobId = ctx.store.generateJobId();
  const syncedAt = new Date().toISOString();

  return {
    ok: true,
    jobId,
    synced: {
      new: newCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      conflict: conflictCount,
      failed: collectResult.errors.length
    },
    summary: collectResult.summary,
    syncedAt
  };
}

// ============================================================================
// Route Pattern Matching
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteMatch {
  handler: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

const ROUTE_PATTERNS: Array<{
  method: HttpMethod;
  pattern: RegExp;
  handler: string;
  paramNames?: string[];
}> = [
  { method: 'GET', pattern: /^\/api\/v1\/commit-ledger\/summary$/, handler: 'getSummary' },
  { method: 'GET', pattern: /^\/api\/v1\/commit-ledger\/commits$/, handler: 'getCommits' },
  { method: 'GET', pattern: /^\/api\/v1\/commit-ledger\/commits\/(.+)$/, handler: 'getCommitById', paramNames: ['recordId'] },
  { method: 'GET', pattern: /^\/api\/v1\/commit-ledger\/projects\/(.+)$/, handler: 'getProject', paramNames: ['projectId'] },
  { method: 'GET', pattern: /^\/api\/v1\/commit-ledger\/verification$/, handler: 'getVerification' },
  { method: 'GET', pattern: /^\/api\/v1\/commit-ledger\/sources$/, handler: 'getSources' },
  { method: 'POST', pattern: /^\/api\/v1\/commit-ledger\/sync$/, handler: 'sync' }
];

/**
 * Match HTTP request to handler
 */
export function matchRoute(method: string, pathname: string): RouteMatch | null {
  for (const route of ROUTE_PATTERNS) {
    if (route.method !== method) continue;

    const match = pathname.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      if (route.paramNames) {
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
      }
      return { handler: route.handler, params, query: {} };
    }
  }
  return null;
}

/**
 * Parse URL search params
 */
export function parseQueryParams(url: URL): Record<string, string> {
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return query;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  handleGetSummary,
  handleGetCommits,
  handleGetCommitById,
  handleGetProject,
  handleGetVerification,
  handleGetSources,
  handleSync,
  matchRoute,
  parseQueryParams,
  getContext,
  initContext
};
