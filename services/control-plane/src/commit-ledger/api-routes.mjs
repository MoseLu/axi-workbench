/**
 * Commit Ledger API Routes
 *
 * Routes for Axi Workbench Commit Ledger
 *
 * Base path: /api/v1/commit-ledger
 * Internal path: /internal/web/v1/commit-ledger
 *
 * The control-plane HTTP server (server.mjs) strips the `/internal/web/v1`
 * prefix before dispatching, so the post-strip path passed in here is
 * `/commit-ledger/*`. The external `/api/v1/commit-ledger/*` path is the
 * Gateway-level URL — the API Gateway rewrites that to the internal path
 * before proxying here.
 */

import { collectAll } from './collect-all.mjs';
import { linkEvidenceBatch, getVerificationStats, detectConflicts, detectStale } from './evidence-linker.mjs';
import { upsertBatch, filterStale } from './ingestion.mjs';

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// In-memory storage for demo (replace with real persistence)
let commitLedgerStore = {
  records: [],
  lastSync: null
};

/**
 * Register Commit Ledger routes on HTTP server
 */
export function registerCommitLedgerRoutes(server) {
  const { sendJson, sendJsonError } = server._sendJsonHelpers || {};

  // These routes are registered in server.mjs
  // This module exports the route handlers
  return {
    handleCommitLedgerRequest: async (req, url, sendJson, sendJsonError) => {
      const pathname = url.pathname;

      // After server.mjs strips /internal/web/v1, the path is /commit-ledger/*.
      // The Gateway-level public path is /api/v1/commit-ledger/*.
      // GET /commit-ledger/summary
      if (req.method === "GET" && pathname === "/commit-ledger/summary") {
        return handleSummary(sendJson, req, url);
      }

      // GET /commit-ledger/commits
      if (req.method === "GET" && pathname === "/commit-ledger/commits") {
        return handleCommits(sendJson, req, url);
      }

      // GET /commit-ledger/commits/:recordId
      const commitsMatch = pathname.match(/^\/commit-ledger\/commits\/(.+)$/);
      if (req.method === "GET" && commitsMatch) {
        return handleCommitById(sendJson, req, url, commitsMatch[1]);
      }

      // GET /commit-ledger/projects/:projectId
      const projectMatch = pathname.match(/^\/commit-ledger\/projects\/(.+)$/);
      if (req.method === "GET" && projectMatch) {
        return handleProjectCommits(sendJson, req, url, projectMatch[1]);
      }

      // GET /commit-ledger/verification
      if (req.method === "GET" && pathname === "/commit-ledger/verification") {
        return handleVerification(sendJson, req, url);
      }

      // GET /commit-ledger/sources
      if (req.method === "GET" && pathname === "/commit-ledger/sources") {
        return handleSources(sendJson, req, url);
      }

      // POST /commit-ledger/sync
      if (req.method === "POST" && pathname === "/commit-ledger/sync") {
        return handleSync(sendJson, req, url);
      }

      return null; // Not handled
    }
  };
}

/**
 * GET /api/v1/commit-ledger/summary  (Gateway) → /commit-ledger/summary (post-strip)
 */
async function handleSummary(sendJson, req, url) {
  const records = commitLedgerStore.records;

  const byPartition = {};
  const partitions = ['projects', 'products', 'shared', 'infra', 'tools'];

  for (const p of partitions) {
    const partitionRecords = records.filter(r => r.repo?.partition === p);
    byPartition[p] = {
      repos: new Set(partitionRecords.map(r => r.repo?.projectId)).size,
      commits: partitionRecords.length
    };
  }

  const stats = getVerificationStats(records);
  const dirtyCount = records.filter(r => r.workspaceState?.isDirty).length;
  const conflicts = detectConflicts(records);

  const summary = {
    workspace: {
      totalProjects: new Set(records.map(r => r.repo?.projectId)).size,
      totalCommits: records.length,
      lastCommitAt: records.length > 0
        ? records.reduce((max, r) => r.commit?.committedAt > max ? r.commit.committedAt : max, '').committedAt
        : null,
      verifiedCommits: stats.verified,
      partialCommits: stats.partial,
      unverifiedCommits: stats.unverified,
      failedCommits: stats.failed,
      dirtyWorkspaces: dirtyCount,
      conflictRecords: conflicts.length,
      failedSources: 0
    },
    byPartition,
    generatedAt: new Date().toISOString()
  };

  return sendJson(200, summary, url);
}

/**
 * GET /api/v1/commit-ledger/commits  (Gateway) → /commit-ledger/commits (post-strip)
 */
async function handleCommits(sendJson, req, url) {
  const params = new URL(url, 'http://localhost').searchParams;
  const records = commitLedgerStore.records;

  // Filters
  let filtered = records;
  if (params.get('projectId')) {
    filtered = filtered.filter(r => r.repo?.projectId === params.get('projectId'));
  }
  if (params.get('partition')) {
    filtered = filtered.filter(r => r.repo?.partition === params.get('partition'));
  }
  if (params.get('type')) {
    filtered = filtered.filter(r => r.commit?.type === params.get('type'));
  }
  if (params.get('verificationStatus')) {
    filtered = filtered.filter(r => r.verification?.status === params.get('verificationStatus'));
  }
  if (params.get('isDirty') === 'true') {
    filtered = filtered.filter(r => r.workspaceState?.isDirty);
  }

  // Pagination
  const page = Math.max(1, parseInt(params.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50')));
  const sort = params.get('sort') || 'committedAt';
  const order = params.get('order') || 'desc';

  // Sort
  filtered.sort((a, b) => {
    const aVal = a.commit?.[sort] || a[sort] || '';
    const bVal = b.commit?.[sort] || b[sort] || '';
    const cmp = String(aVal).localeCompare(String(bVal));
    return order === 'desc' ? -cmp : cmp;
  });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return sendJson(200, {
    data,
    pagination: {
      page,
      limit,
      total,
      hasMore: start + limit < total
    }
  }, url);
}

/**
 * GET /api/v1/commit-ledger/commits/:recordId  (Gateway) → /commit-ledger/commits/:recordId (post-strip)
 */
async function handleCommitById(sendJson, req, url, recordId) {
  const record = commitLedgerStore.records.find(r => r.recordId === recordId);

  if (!record) {
    return sendJson(404, { error: { code: 'NOT_FOUND', message: 'Commit not found', recordId } }, url);
  }

  return sendJson(200, record, url);
}

/**
 * GET /api/v1/commit-ledger/projects/:projectId  (Gateway) → /commit-ledger/projects/:projectId (post-strip)
 */
async function handleProjectCommits(sendJson, req, url, projectId) {
  const records = commitLedgerStore.records.filter(r => r.repo?.projectId === projectId);

  if (records.length === 0) {
    return sendJson(404, { error: { code: 'NOT_FOUND', message: 'Project not found', projectId } }, url);
  }

  const stats = getVerificationStats(records);
  const firstRecord = records[0];

  const project = {
    id: projectId,
    canonicalPath: firstRecord.repo?.canonicalPath,
    branch: firstRecord.workspaceState?.observedBranch,
    head: firstRecord.commit?.shortSha,
    isDirty: firstRecord.workspaceState?.isDirty,
    commitCount: records.length,
    lastCommitAt: records.reduce((latest, r) =>
      r.commit?.committedAt > latest ? r.commit.committedAt : latest, ''),
    partition: firstRecord.repo?.partition
  };

  return sendJson(200, {
    project,
    verification: stats,
    evidenceCoverage: stats.verified + stats.partial > 0
      ? ((stats.verified + stats.partial) / records.length).toFixed(2)
      : 0
  }, url);
}

/**
 * GET /api/v1/commit-ledger/verification  (Gateway) → /commit-ledger/verification (post-strip)
 */
async function handleVerification(sendJson, req, url) {
  try {
    const records = commitLedgerStore.records;
  const stats = getVerificationStats(records);
  const byProject = {};
  const stale = detectStale(records);

  // Group by project
  for (const record of records) {
    const pid = record.repo?.projectId;
    if (!byProject[pid]) {
      byProject[pid] = { verified: 0, partial: 0, unverified: 0, failed: 0, total: 0 };
    }
    byProject[pid].total++;
    const status = record.verification?.status || 'unknown';
    if (byProject[pid].hasOwnProperty(status)) {
      byProject[pid][status]++;
    }
  }

  return sendJson(200, {
    status: stats,
    byProject: Object.entries(byProject).map(([projectId, s]) => ({
      projectId,
      ...s,
      coverage: s.total > 0 ? ((s.verified + s.partial) / s.total).toFixed(2) : 0
    })),
    staleRecords: stale
  }, url);
  } catch (err) {
    return sendJson(500, { error: 'VERIFICATION_FAILED', message: err.message, stack: err.stack }, url);
  }
}

/**
 * GET /api/v1/commit-ledger/sources  (Gateway) → /commit-ledger/sources (post-strip)
 */
async function handleSources(sendJson, req, url) {
  try {
    const records = commitLedgerStore.records;

  // Group by source
  const sourceMap = new Map();
  for (const record of records) {
    const path = record.provenance?.sourcePath || record.repo?.canonicalPath;
    if (!sourceMap.has(path)) {
      sourceMap.set(path, {
        repoId: record.repo?.projectId,
        path,
        lastSeenAt: record.ingestion?.lastSeenAt,
        commitCount: 0,
        status: 'active',
        errors: []
      });
    }
    sourceMap.get(path).commitCount++;
    if (record.provenance?.lastSeenAt > sourceMap.get(path).lastSeenAt) {
      sourceMap.get(path).lastSeenAt = record.provenance.lastSeenAt;
    }
  }

  const sources = Array.from(sourceMap.values());

  return sendJson(200, {
    sources,
    failedSources: sources.filter(s => s.status === 'failed').length
  }, url);
  } catch (err) {
    return sendJson(500, { error: 'SOURCES_FAILED', message: err.message, stack: err.stack }, url);
  }
}

/**
 * POST /api/v1/commit-ledger/sync  (Gateway) → /commit-ledger/sync (post-strip)
 *
 * Body (optional): { maxCommits?: number, incremental?: boolean }
 * - maxCommits: cap how many commits are linked/upserted in one call (perf guard)
 * - incremental: skip sync when lastSync is recent enough (within lastSyncWindowMs)
 */
async function handleSync(sendJson, req, url) {
  try {
    let body = {};
    try { body = await readJsonBody(req); } catch { body = {}; }
    const maxCommits = Number.isFinite(body?.maxCommits) ? body.maxCommits : 500;
    const incremental = body?.incremental === true;
    const lastSyncWindowMs = 60 * 1000;

    if (incremental && commitLedgerStore.lastSync) {
      const elapsed = Date.now() - new Date(commitLedgerStore.lastSync).getTime();
      if (elapsed < lastSyncWindowMs && (commitLedgerStore.records?.length || 0) > 0) {
        return sendJson(200, {
          ok: true,
          skipped: true,
          reason: "recent_sync",
          lastSync: commitLedgerStore.lastSync,
          summary: { totalCommits: commitLedgerStore.records.length }
        }, url);
      }
    }

    // Run collector
    const result = collectAll({});

    // Link evidence (capped for perf)
    const allRecords = result.results.flatMap(r => r.commits);
    const sliced = allRecords.slice(0, maxCommits);
    const linkedRecords = linkEvidenceBatch(sliced);

    // Upsert with existing records
    const upsertResult = upsertBatch(commitLedgerStore.records, linkedRecords);

    // Update store
    commitLedgerStore.records = [
      ...upsertResult.new,
      ...upsertResult.updated,
      ...upsertResult.unchanged,
      ...upsertResult.conflict
    ];
    commitLedgerStore.lastSync = new Date().toISOString();

    return sendJson(200, {
      ok: true,
      synced: {
        new: upsertResult.new.length,
        updated: upsertResult.updated.length,
        unchanged: upsertResult.unchanged.length,
        conflict: upsertResult.conflict.length,
        failed: result.errors.length,
        totalSeen: allRecords.length,
        processed: sliced.length,
        maxCommits
      },
      summary: result.summary,
      syncedAt: commitLedgerStore.lastSync
    }, url);
  } catch (error) {
    return sendJson(500, { error: { code: 'SYNC_FAILED', message: error.message } }, url);
  }
}

/**
 * Get store for testing
 */
export function getCommitLedgerStore() {
  return commitLedgerStore;
}

/**
 * Set store for testing
 */
export function setCommitLedgerStore(records) {
  commitLedgerStore.records = records;
}
