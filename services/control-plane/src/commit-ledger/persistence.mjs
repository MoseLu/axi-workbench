/**
 * Commit Ledger Persistence Layer
 *
 * JSONL file-based local storage adapter
 * Location: services/control-plane/.cache/commit-ledger/
 * Files: ledger.jsonl (records), index.json (metadata)
 *
 * @module persistence
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '../../.cache/commit-ledger');
const LEDGER_FILE = join(CACHE_DIR, 'ledger.jsonl');
const INDEX_FILE = join(CACHE_DIR, 'index.json');

// ============================================================================
// Types & Interfaces (JSDoc + TypeScript-style)
// ============================================================================

/**
 * @typedef {Object} CommitLedgerV1
 * @property {string} schemaVersion
 * @property {string} recordId
 * @property {Object} repo
 * @property {string} repo.projectId
 * @property {string} repo.canonicalPath
 * @property {string} repo.gitRoot
 * @property {string} repo.defaultBranch
 * @property {string|undefined} repo.remote
 * @property {Object} commit
 * @property {string} commit.sha
 * @property {string} commit.shortSha
 * @property {string[]} commit.parentShas
 * @property {string} commit.subject
 * @property {string} [commit.body]
 * @property {string} [commit.type]
 * @property {string|null} [commit.scope]
 * @property {boolean} [commit.breaking]
 * @property {string} commit.authoredAt
 * @property {string} commit.committedAt
 * @property {Object} actor
 * @property {string} actor.name
 * @property {string|null} [actor.email]
 * @property {Object} [refs]
 * @property {string[]} [refs.branches]
 * @property {string[]} [refs.tags]
 * @property {Object} [diff]
 * @property {number} [diff.filesChanged]
 * @property {number} [diff.insertions]
 * @property {number} [diff.deletions]
 * @property {Object} [trailers]
 * @property {string[]} [trailers.tested]
 * @property {string[]} [trailers.notTested]
 * @property {number|null} [trailers.confidence]
 * @property {string|null} [trailers.scopeRisk]
 * @property {string|null} [trailers.directive]
 * @property {string[]} [trailers.refs]
 * @property {Object} [workspaceState]
 * @property {string} [workspaceState.observedBranch]
 * @property {boolean} [workspaceState.isDirty]
 * @property {number} [workspaceState.ahead]
 * @property {number} [workspaceState.behind]
 * @property {string} [workspaceState.observedAt]
 * @property {Object} [verification]
 * @property {'verified'|'partial'|'unverified'|'failed'|'conflict'|'unknown'} [verification.status]
 * @property {string[]} [verification.commands]
 * @property {string[]} [verification.evidenceRefs]
 * @property {string} [verification.observedAt]
 * @property {Object} provenance
 * @property {string} provenance.source
 * @property {string} provenance.sourcePath
 * @property {string} [provenance.sourceCommand]
 * @property {string} [provenance.sourceHash]
 * @property {string} provenance.observedAt
 * @property {Object} ingestion
 * @property {string} ingestion.idempotencyKey
 * @property {string} ingestion.firstSeenAt
 * @property {string} ingestion.lastSeenAt
 * @property {'new'|'updated'|'unchanged'|'conflict'} ingestion.status
 */

/**
 * @typedef {Object} QueryFilter
 * @property {string} [projectId]
 * @property {string} [partition]
 * @property {string} [branch]
 * @property {string} [author]
 * @property {string} [type]
 * @property {string} [scope]
 * @property {string} [dateFrom]
 * @property {string} [dateTo]
 * @property {string} [verificationStatus]
 * @property {boolean} [dirty]
 */

/**
 * @typedef {Object} Pagination
 * @property {string} [cursor] - Base64 encoded cursor for pagination
 * @property {number} [limit] - Max records per page (default 50, max 100)
 * @property {string} [sortBy] - Sort field: 'committedAt' | 'verificationStatus'
 * @property {'asc'|'desc'} [sortOrder]
 */

/**
 * @typedef {Object} QueryResult
 * @property {CommitLedgerV1[]} data
 * @property {Object} pagination
 * @property {string} pagination.nextCursor
 * @property {boolean} pagination.hasMore
 * @property {number} pagination.total
 */

/**
 * @typedef {Object} ImportResult
 * @property {number} imported
 * @property {number} skipped
 * @property {number} errors
 * @property {string[]} [errorDetails]
 * @property {string} jobId
 * @property {string} startedAt
 * @property {string} completedAt
 */

/**
 * @typedef {Object} UpsertResult
 * @property {'new'|'updated'|'unchanged'|'conflict'} status
 * @property {CommitLedgerV1} record
 * @property {boolean} [conflict]
 */

/**
 * @typedef {Object} ConflictResult
 * @property {boolean} hasConflict
 * @property {string} [reason]
 * @property {'sha_mismatch'|'verification_conflict'|'source_conflict'|null} [conflictType]
 */

/**
 * @typedef {Object} RefreshResult
 * @property {string} repoId
 * @property {number} recordsRefreshed
 * @property {string} refreshedAt
 */

/**
 * @typedef {Object} StaleResult
 * @property {string} recordId
 * @property {string} repoId
 * @property {string} lastObserved
 * @property {number} daysStale
 */

/**
 * @typedef {Object} IndexMetadata
 * @property {number} totalRecords
 * @property {string} lastUpdated
 * @property {string} lastSync
 * @property {Object} stats
 * @property {Object} jobs
 */

// ============================================================================
// Storage Class
// ============================================================================

/**
 * CommitLedgerStore - JSONL file-based persistence adapter
 */
export class CommitLedgerStore {
  /** @type {string} */
  cacheDir;
  /** @type {string} */
  ledgerFile;
  /** @type {string} */
  indexFile;
  /** @type {Map<string, CommitLedgerV1>} */
  #recordCache;
  /** @type {IndexMetadata|null} */
  #index;

  constructor(options = {}) {
    this.cacheDir = options.cacheDir || CACHE_DIR;
    this.ledgerFile = options.ledgerFile || LEDGER_FILE;
    this.indexFile = options.indexFile || INDEX_FILE;
    this.#recordCache = new Map();
    this.#index = null;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Ensure storage directory exists
   */
  ensureStorage() {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
    return this;
  }

  /**
   * Load all records from JSONL into memory cache
   * @returns {Promise<Map<string, CommitLedgerV1>>}
   */
  async loadRecords() {
    this.ensureStorage();

    if (!existsSync(this.ledgerFile)) {
      return this.#recordCache;
    }

    const content = readFileSync(this.ledgerFile, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.recordId) {
          this.#recordCache.set(record.recordId, record);
        }
      } catch (e) {
        // Skip malformed lines
        console.warn(`Skipping malformed JSONL line: ${e.message}`);
      }
    }

    return this.#recordCache;
  }

  /**
   * Load index metadata
   * @returns {IndexMetadata}
   */
  loadIndex() {
    this.ensureStorage();

    if (!existsSync(this.indexFile)) {
      this.#index = this.createEmptyIndex();
      return this.#index;
    }

    try {
      const content = readFileSync(this.indexFile, 'utf-8');
      this.#index = JSON.parse(content);
    } catch (e) {
      this.#index = this.createEmptyIndex();
    }

    return this.#index;
  }

  /**
   * Create empty index structure
   * @returns {IndexMetadata}
   */
  createEmptyIndex() {
    return {
      totalRecords: 0,
      lastUpdated: new Date().toISOString(),
      lastSync: null,
      stats: {
        byPartition: {},
        byType: {},
        byVerificationStatus: {},
        bySource: {}
      },
      jobs: {}
    };
  }

  // -------------------------------------------------------------------------
  // Full Snapshot Import
  // -------------------------------------------------------------------------

  /**
   * Import full snapshot (replaces all records)
   * @param {CommitLedgerV1[]} records
   * @returns {ImportResult}
   */
  importSnapshot(records) {
    this.ensureStorage();
    const startTime = new Date().toISOString();
    const jobId = this.generateJobId();

    const result = {
      imported: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      jobId,
      startedAt: startTime,
      completedAt: null
    };

    try {
      // Clear existing ledger
      writeFileSync(this.ledgerFile, '');

      // Write all records
      for (const record of records) {
        try {
          appendFileSync(this.ledgerFile, JSON.stringify(record) + '\n');
          this.#recordCache.set(record.recordId, record);
          result.imported++;
        } catch (e) {
          result.errors++;
          result.errorDetails.push(`Record ${record.recordId}: ${e.message}`);
        }
      }

      // Update index
      this.updateIndexStats(records);
      this.#index.lastSync = startTime;
      this.#index.lastUpdated = new Date().toISOString();
      this.#index.totalRecords = result.imported;
      this.#index.jobs[jobId] = {
        type: 'snapshot',
        startedAt: startTime,
        completedAt: new Date().toISOString(),
        recordsImported: result.imported,
        recordsSkipped: result.skipped,
        errors: result.errors
      };
      this.saveIndex();

      result.completedAt = new Date().toISOString();
    } catch (e) {
      result.errors++;
      result.errorDetails.push(`Fatal: ${e.message}`);
      result.completedAt = new Date().toISOString();
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Incremental Import
  // -------------------------------------------------------------------------

  /**
   * Import records incrementally (merges with existing)
   * @param {CommitLedgerV1[]} records
   * @returns {ImportResult}
   */
  importIncremental(records) {
    this.ensureStorage();
    const startTime = new Date().toISOString();
    const jobId = this.generateJobId();

    const result = {
      imported: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
      jobId,
      startedAt: startTime,
      completedAt: null
    };

    // Build existing record map by idempotency key
    const existingKeys = new Map();
    for (const [recordId, record] of this.#recordCache) {
      const key = record.ingestion?.idempotencyKey || recordId;
      existingKeys.set(key, record);
    }

    for (const record of records) {
      try {
        const key = record.ingestion?.idempotencyKey || `${record.repo?.projectId}:${record.commit?.sha}`;
        const existing = existingKeys.get(key);

        if (existing) {
          result.skipped++;
          continue;
        }

        appendFileSync(this.ledgerFile, JSON.stringify(record) + '\n');
        this.#recordCache.set(record.recordId, record);
        result.imported++;
      } catch (e) {
        result.errors++;
        result.errorDetails.push(`Record ${record.recordId}: ${e.message}`);
      }
    }

    // Update index
    this.updateIndexStats(Array.from(this.#recordCache.values()));
    this.#index.lastSync = startTime;
    this.#index.lastUpdated = new Date().toISOString();
    this.#index.totalRecords = this.#recordCache.size;
    this.#index.jobs[jobId] = {
      type: 'incremental',
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      recordsImported: result.imported,
      recordsSkipped: result.skipped,
      errors: result.errors
    };
    this.saveIndex();

    result.completedAt = new Date().toISOString();
    return result;
  }

  // -------------------------------------------------------------------------
  // Single Record Upsert
  // -------------------------------------------------------------------------

  /**
   * Upsert a single record by repoId + commitSha
   * @param {CommitLedgerV1} record
   * @returns {UpsertResult}
   */
  upsert(record) {
    const key = record.ingestion?.idempotencyKey || `${record.repo?.projectId}:${record.commit?.sha}`;
    const existing = this.#recordCache.get(record.recordId);

    if (!existing) {
      // New record
      appendFileSync(this.ledgerFile, JSON.stringify(record) + '\n');
      this.#recordCache.set(record.recordId, record);
      return { status: 'new', record };
    }

    // Detect conflict
    const conflictResult = this.detectConflict(record);
    if (conflictResult.hasConflict) {
      // Resolve by newer wins
      const existingTime = new Date(existing.ingestion?.lastSeenAt || 0);
      const incomingTime = new Date(record.provenance?.observedAt || 0);

      if (incomingTime > existingTime) {
        this.#recordCache.set(record.recordId, record);
        return { status: 'conflict', record, conflict: true };
      }
      return { status: 'unchanged', record: existing, conflict: true };
    }

    // Check if content changed
    if (JSON.stringify(existing) === JSON.stringify(record)) {
      return { status: 'unchanged', record: existing };
    }

    // Update
    const updated = {
      ...record,
      ingestion: {
        ...record.ingestion,
        firstSeenAt: existing.ingestion?.firstSeenAt || record.ingestion?.firstSeenAt,
        lastSeenAt: new Date().toISOString()
      }
    };

    // Rewrite ledger (simple approach: append update marker)
    // For production, consider compaction strategy
    this.#recordCache.set(record.recordId, updated);
    return { status: 'updated', record: updated };
  }

  // -------------------------------------------------------------------------
  // Conflict Detection
  // -------------------------------------------------------------------------

  /**
   * Detect conflicts with existing record
   * @param {CommitLedgerV1} record
   * @returns {ConflictResult}
   */
  detectConflict(record) {
    const existing = this.#recordCache.get(record.recordId);
    if (!existing) {
      return { hasConflict: false, conflictType: null };
    }

    // SHA mismatch
    if (existing.commit?.sha !== record.commit?.sha) {
      return {
        hasConflict: true,
        reason: 'SHA mismatch between existing and incoming record',
        conflictType: 'sha_mismatch'
      };
    }

    // Verification status conflict
    const existingStatus = existing.verification?.status;
    const incomingStatus = record.verification?.status;
    if (existingStatus && incomingStatus) {
      if ((existingStatus === 'verified' && incomingStatus === 'failed') ||
          (existingStatus === 'failed' && incomingStatus === 'verified')) {
        return {
          hasConflict: true,
          reason: 'Verified/failed status conflict',
          conflictType: 'verification_conflict'
        };
      }
    }

    // Source conflict
    if (existing.provenance?.source !== record.provenance?.source) {
      return {
        hasConflict: true,
        reason: 'Provenance source conflict',
        conflictType: 'source_conflict'
      };
    }

    return { hasConflict: false, conflictType: null };
  }

  // -------------------------------------------------------------------------
  // Source Refresh
  // -------------------------------------------------------------------------

  /**
   * Refresh all records for a specific repo
   * @param {string} repoId
   * @returns {RefreshResult}
   */
  refreshSource(repoId) {
    let recordsRefreshed = 0;

    for (const [recordId, record] of this.#recordCache) {
      if (record.repo?.projectId === repoId) {
        record.ingestion = record.ingestion || {};
        record.ingestion.lastSeenAt = new Date().toISOString();
        this.#recordCache.set(recordId, record);
        recordsRefreshed++;
      }
    }

    return {
      repoId,
      recordsRefreshed,
      refreshedAt: new Date().toISOString()
    };
  }

  // -------------------------------------------------------------------------
  // Stale Detection
  // -------------------------------------------------------------------------

  /**
   * Detect stale records
   * @param {CommitLedgerV1[]} [records] - If not provided, checks all records
   * @param {number} [thresholdDays=30]
   * @returns {StaleResult[]}
   */
  detectStale(records, thresholdDays = 30) {
    const recordsToCheck = records || Array.from(this.#recordCache.values());
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - thresholdDays);

    const stale = [];

    for (const record of recordsToCheck) {
      const observedAt = new Date(
        record.verification?.observedAt ||
        record.ingestion?.lastSeenAt ||
        record.provenance?.observedAt
      );

      if (observedAt < threshold) {
        const daysStale = Math.floor(
          (Date.now() - observedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        stale.push({
          recordId: record.recordId,
          repoId: record.repo?.projectId,
          lastObserved: observedAt.toISOString(),
          daysStale
        });
      }
    }

    return stale.sort((a, b) => b.daysStale - a.daysStale);
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /**
   * Query records with filtering and pagination
   * @param {QueryFilter} filter
   * @param {Pagination} pagination
   * @returns {QueryResult}
   */
  query(filter = {}, pagination = {}) {
    let records = Array.from(this.#recordCache.values());

    // Apply filters
    if (filter.projectId) {
      records = records.filter(r => r.repo?.projectId === filter.projectId);
    }
    if (filter.partition) {
      records = records.filter(r => r.repo?.partition === filter.partition);
    }
    if (filter.branch) {
      records = records.filter(r =>
        r.refs?.branches?.includes(filter.branch) ||
        r.workspaceState?.observedBranch === filter.branch
      );
    }
    if (filter.author) {
      records = records.filter(r =>
        r.actor?.name === filter.author ||
        r.actor?.email === filter.author
      );
    }
    if (filter.type) {
      records = records.filter(r => r.commit?.type === filter.type);
    }
    if (filter.scope) {
      records = records.filter(r => r.commit?.scope === filter.scope);
    }
    if (filter.dateFrom) {
      const from = new Date(filter.dateFrom);
      records = records.filter(r => new Date(r.commit?.committedAt) >= from);
    }
    if (filter.dateTo) {
      const to = new Date(filter.dateTo);
      records = records.filter(r => new Date(r.commit?.committedAt) <= to);
    }
    if (filter.verificationStatus) {
      records = records.filter(r => r.verification?.status === filter.verificationStatus);
    }
    if (filter.dirty !== undefined) {
      records = records.filter(r => r.workspaceState?.isDirty === filter.dirty);
    }

    // Sort
    const sortBy = pagination.sortBy || 'committedAt';
    const sortOrder = pagination.sortOrder || 'desc';
    records.sort((a, b) => {
      let aVal, bVal;

      if (sortBy === 'committedAt') {
        aVal = new Date(a.commit?.committedAt || 0).getTime();
        bVal = new Date(b.commit?.committedAt || 0).getTime();
      } else if (sortBy === 'verificationStatus') {
        const statusOrder = ['verified', 'partial', 'unverified', 'failed', 'unknown'];
        aVal = statusOrder.indexOf(a.verification?.status || 'unknown');
        bVal = statusOrder.indexOf(b.verification?.status || 'unknown');
      } else {
        aVal = a[sortBy] || '';
        bVal = b[sortBy] || '';
      }

      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const total = records.length;

    // Cursor-based pagination
    let startIndex = 0;
    if (pagination.cursor) {
      try {
        const cursorData = JSON.parse(Buffer.from(pagination.cursor, 'base64').toString('utf-8'));
        const cursorRecordId = cursorData.recordId;
        const cursorIndex = records.findIndex(r => r.recordId === cursorRecordId);
        if (cursorIndex >= 0) {
          startIndex = cursorIndex + 1;
        }
      } catch (e) {
        // Invalid cursor, start from beginning
      }
    }

    const limit = Math.min(pagination.limit || 50, 100);
    const pageRecords = records.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < total;

    // Generate next cursor
    let nextCursor = null;
    if (hasMore && pageRecords.length > 0) {
      const lastRecord = pageRecords[pageRecords.length - 1];
      nextCursor = Buffer.from(JSON.stringify({
        recordId: lastRecord.recordId,
        sortBy,
        sortOrder
      })).toString('base64');
    }

    return {
      data: pageRecords,
      pagination: {
        nextCursor,
        hasMore,
        total
      }
    };
  }

  // -------------------------------------------------------------------------
  // Utility Methods
  // -------------------------------------------------------------------------

  /**
   * Generate unique job ID
   * @returns {string}
   */
  generateJobId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Update index statistics
   * @param {CommitLedgerV1[]} records
   */
  updateIndexStats(records) {
    this.#index = this.#index || this.createEmptyIndex();
    this.#index.stats = {
      byPartition: {},
      byType: {},
      byVerificationStatus: {},
      bySource: {}
    };

    for (const record of records) {
      // By partition
      const partition = record.repo?.partition || 'unknown';
      this.#index.stats.byPartition[partition] =
        (this.#index.stats.byPartition[partition] || 0) + 1;

      // By type
      const type = record.commit?.type || 'unknown';
      this.#index.stats.byType[type] =
        (this.#index.stats.byType[type] || 0) + 1;

      // By verification status
      const status = record.verification?.status || 'unknown';
      this.#index.stats.byVerificationStatus[status] =
        (this.#index.stats.byVerificationStatus[status] || 0) + 1;

      // By source
      const source = record.provenance?.source || 'unknown';
      this.#index.stats.bySource[source] =
        (this.#index.stats.bySource[source] || 0) + 1;
    }
  }

  /**
   * Save index to disk
   */
  saveIndex() {
    writeFileSync(this.indexFile, JSON.stringify(this.#index, null, 2));
  }

  /**
   * Get all records
   * @returns {CommitLedgerV1[]}
   */
  getAllRecords() {
    return Array.from(this.#recordCache.values());
  }

  /**
   * Get record by ID
   * @param {string} recordId
   * @returns {CommitLedgerV1|null}
   */
  getById(recordId) {
    return this.#recordCache.get(recordId) || null;
  }

  /**
   * Get index metadata
   * @returns {IndexMetadata}
   */
  getIndex() {
    return this.#index || this.loadIndex();
  }

  /**
   * Clear all records (use with caution)
   */
  clear() {
    this.#recordCache.clear();
    if (existsSync(this.ledgerFile)) {
      writeFileSync(this.ledgerFile, '');
    }
    this.#index = this.createEmptyIndex();
    this.saveIndex();
  }
}

// ============================================================================
// Default Export
// ============================================================================

/** @type {CommitLedgerStore} */
let defaultStore = null;

/**
 * Get or create default store instance
 * @returns {CommitLedgerStore}
 */
export function getStore() {
  if (!defaultStore) {
    defaultStore = new CommitLedgerStore();
  }
  return defaultStore;
}

/**
 * Reset default store (for testing)
 */
export function resetStore() {
  defaultStore = null;
}
