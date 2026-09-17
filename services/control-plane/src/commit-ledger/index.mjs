/**
 * Commit Ledger Module Index
 * Axi Workbench Commit Ledger - Git commit log governance
 */

export { collectAll, collectRepoCommits, generateRecordId, parseConventionalCommit } from './collect-all.mjs';
export { linkEvidence, linkEvidenceBatch, detectConflicts, detectStale, getVerificationStats, VerificationStatus } from './evidence-linker.mjs';
export { upsert, upsertBatch, detectConflict, generateIdempotencyKey, IngestionStatus, ConflictResolution, resolveConflict } from './ingestion.mjs';
export { registerCommitLedgerRoutes, getCommitLedgerStore, setCommitLedgerStore } from './api-routes.mjs';

// Schema version
export const SCHEMA_VERSION = 'commit-ledger.v1';
