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
  StaleRecord
} from './evidence-linker.js';
import { collectAll, CommitRecord } from './collector.js';

// Re-export types for consumers
export type { CommitLedgerV1, QueryFilter, Pagination, QueryResult } from './persistence.js';
export type { VerificationStats, Conflict, StaleRecord, VerificationStatus } from './evidence-linker.js';

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
  const records = ctx.store.getAllRecords();

  // Count by partition
  const byPartition: Record<string, { repos: number; commits: number }> = {};
  const partitions = ['projects', 'products', 'shared', 'infra', 'tools'];

  for (const p of partitions) {
    const partitionRecords = records.filter(r => (r.repo as any)?.partition === p);
    byPartition[p] = {
      repos: new Set(partitionRecords.map(r => (r.repo as any)?.projectId)).size,
      commits: partitionRecords.length
    };
  }

  // Verification stats
  const verification = getVerificationStats(records as any);

  // Dirty workspaces
  const dirtyWorkspaces = records.filter(r => (r.workspaceState as any)?.isDirty).length;

  // Conflicts
  const conflicts = detectConflicts(records as any);

  // Find last commit
  let lastCommitAt: string | null = null;
  if (records.length > 0) {
    const sorted = [...records].sort((a, b) =>
      new Date((b.commit as any)?.committedAt || 0).getTime() -
      new Date((a.commit as any)?.committedAt || 0).getTime()
    );
    lastCommitAt = (sorted[0].commit as any)?.committedAt || null;
  }

  // Count unique projects
  const totalProjects = new Set(records.map(r => (r.repo as any)?.projectId)).size;

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
): PaginatedResult<any> {
  // Build filter object for persistence layer
  const filter: any = {};

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
  const pageOptions: any = {
    cursor: pagination.cursor,
    limit: Math.min(pagination.limit || 50, 100),
    sortBy: pagination.sortBy || 'committedAt',
    sortOrder: pagination.sortOrder || 'desc'
  };

  const result = ctx.store.query(filter, pageOptions);

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
): { data: any } | { error: { code: string; message: string; recordId: string } } {
  const record = ctx.store.getById(recordId);

  if (!record) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'Commit record not found',
        recordId
      }
    };
  }

  // Enhance with evidence linking
  const linked = linkEvidenceBatch([record as any]);

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
  const result = ctx.store.query({ projectId }, { limit: 10000 });
  const records = result.data;

  if (records.length === 0) {
    return {
      error: {
        code: 'NOT_FOUND',
        message: 'Project not found or has no commits',
        projectId
      }
    };
  }

  const verification = getVerificationStats(records as any);

  // Find latest commit
  const sorted = [...records].sort((a, b) =>
    new Date((b.commit as any)?.committedAt || 0).getTime() -
    new Date((a.commit as any)?.committedAt || 0).getTime()
  );
  const latest = sorted[0];

  // Calculate coverage
  const coverage = records.length > 0
    ? Number(((verification.verified + verification.partial) / records.length).toFixed(2))
    : 0;

  return {
    data: {
      id: projectId,
      canonicalPath: (latest.repo as any)?.canonicalPath || null,
      partition: (latest.repo as any)?.partition || null,
      branch: (latest.workspaceState as any)?.observedBranch || null,
      head: (latest.commit as any)?.shortSha || null,
      isDirty: (latest.workspaceState as any)?.isDirty || false,
      commitCount: records.length,
      lastCommitAt: (latest.commit as any)?.committedAt || null,
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
  status: any;
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
  const records = ctx.store.getAllRecords();
  const status = getVerificationStats(records as any);

  // Group by project
  const byProjectMap: Record<string, any> = {};

  for (const record of records) {
    const pid = (record.repo as any)?.projectId || 'unknown';
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
    const recStatus = (record.verification as any)?.status || 'unknown';
    if (recStatus in byProjectMap[pid]) {
      (byProjectMap[pid] as any)[recStatus]++;
    }
  }

  // Calculate coverage per project
  const byProject = Object.values(byProjectMap).map((p: any) => ({
    ...p,
    coverage: p.total > 0
      ? Number(((p.verified + p.partial) / p.total).toFixed(2))
      : 0
  }));

  // Detect stale records
  const staleRecords = detectStale(records as any);

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
  const records = ctx.store.getAllRecords();

  // Group by source path
  const sourceMap: Map<string, SourceInfo> = new Map();

  for (const record of records) {
    const path = (record.provenance as any)?.sourcePath || (record.repo as any)?.canonicalPath || 'unknown';
    const repoId = (record.repo as any)?.projectId || null;

    if (!sourceMap.has(path)) {
      sourceMap.set(path, {
        repoId,
        path,
        lastSeenAt: (record.ingestion as any)?.lastSeenAt || null,
        commitCount: 0,
        status: 'active'
      });
    }

    const source = sourceMap.get(path)!;
    source.commitCount++;

    // Update last seen
    const recordLastSeen = (record.ingestion as any)?.lastSeenAt;
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

  // Link evidence to new records
  const allNewRecords = collectResult.results.flatMap((r) => r.commits as CommitRecord[]);
  const linkedRecords = linkEvidenceBatch(allNewRecords);

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
