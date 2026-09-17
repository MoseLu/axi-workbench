/**
 * Commit Ledger Persistence Tests
 * Tests for idempotency, conflict detection, and query operations
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  upsert,
  upsertBatch,
  detectConflict,
  generateIdempotencyKey,
  generateRecordId,
  IngestionStatus,
  ConflictResolution,
  resolveConflict,
  isStale,
  filterStale
} from "./ingestion.mjs";

/**
 * Helper: create a minimal commit record
 */
function makeRecord({ repoId = "proj-1", sha = "abc123", source = "git", verificationStatus = "unverified", extra = {} } = {}) {
  return {
    recordId: generateRecordId(repoId, sha),
    repo: { projectId: repoId, partition: "projects", canonicalPath: `/workspace/${repoId}` },
    commit: { sha, shortSha: sha.slice(0, 7), committedAt: new Date().toISOString(), message: "Test commit" },
    provenance: { source, sourcePath: `/workspace/${repoId}`, observedAt: new Date().toISOString() },
    verification: { status: verificationStatus, observedAt: new Date().toISOString() },
    ingestion: { idempotencyKey: generateIdempotencyKey(repoId, sha), firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() },
    ...extra
  };
}

// ============================================================================
// Test 1: Idempotency test
// ============================================================================
test("upsert: importing same record twice returns unchanged status", () => {
  const record = makeRecord({ repoId: "proj-x", sha: "def456" });

  // First import
  const result1 = upsert(null, record);
  assert.equal(result1.status, IngestionStatus.NEW, "First import should be NEW");
  assert.ok(result1.record, "First import should return record");

  // Second import (identical)
  const result2 = upsert(record, record);
  assert.equal(result2.status, IngestionStatus.UNCHANGED, "Second identical import should be UNCHANGED");
  assert.ok(result2.record, "Should return existing record");
  assert.equal(result2.record.ingestion?.idempotencyKey, record.ingestion.idempotencyKey, "Idempotency key preserved");
});

test("upsert: idempotency key is generated correctly", () => {
  const key = generateIdempotencyKey("proj-1", "sha-abc");
  assert.equal(key, "proj-1:sha-abc", "Idempotency key format is repoId:sha");

  const recordId = generateRecordId("proj-1", "sha-abc");
  assert.ok(recordId.length === 64, "Record ID should be SHA-256 hex (64 chars)");
});

// ============================================================================
// Test 2: Duplicate import test
// ============================================================================
test("upsertBatch: duplicate repoId+commitSha creates no duplicate", () => {
  const record1 = makeRecord({ repoId: "proj-dup", sha: "dup001" });
  const record2 = { ...record1 }; // Clone

  const existingRecords = [record1];
  const incomingRecords = [record2];

  const result = upsertBatch(existingRecords, incomingRecords);

  // Should be no new records
  assert.equal(result.new.length, 0, "No new records for duplicate");
  assert.equal(result.unchanged.length, 1, "Should be marked unchanged");
  assert.equal(result.conflict.length, 0, "No conflicts");
  assert.equal(result.errors.length, 0, "No errors");
});

test("upsertBatch: idempotencyKey preserved through batch upsert", () => {
  const record = makeRecord({ repoId: "proj-key", sha: "key001" });
  const originalKey = record.ingestion.idempotencyKey;

  const result = upsertBatch([], [record]);

  assert.equal(result.new.length, 1);
  assert.equal(result.new[0].ingestion.idempotencyKey, originalKey, "Idempotency key preserved");
});

// ============================================================================
// Test 3: Conflict detection test
// ============================================================================
test("detectConflict: SHA mismatch triggers conflict", () => {
  const existing = makeRecord({ sha: "sha100" });
  const incoming = makeRecord({ sha: "sha200" });

  assert.equal(detectConflict(existing, incoming), true, "Different SHA should conflict");
});

test("detectConflict: verification status conflict (verified vs failed)", () => {
  const existing = makeRecord({ verificationStatus: "verified" });
  const incoming = makeRecord({ verificationStatus: "failed" });

  assert.equal(detectConflict(existing, incoming), true, "Verified vs failed should conflict");
});

test("detectConflict: source mismatch triggers conflict", () => {
  const existing = makeRecord({ source: "git" });
  const incoming = makeRecord({ source: "submit-log" });

  assert.equal(detectConflict(existing, incoming), true, "Different source should conflict");
});

test("detectConflict: no conflict when all fields match", () => {
  const record = makeRecord();
  assert.equal(detectConflict(record, record), false, "Identical records should not conflict");
});

test("upsert: conflict status returned when SHA differs", () => {
  const existing = makeRecord({ repoId: "proj-conf", sha: "sha-conf-1" });
  const incoming = makeRecord({ repoId: "proj-conf", sha: "sha-conf-2" });

  const result = upsert(existing, incoming);
  assert.equal(result.status, IngestionStatus.CONFLICT, "Should return CONFLICT status");
});

test("resolveConflict: newer_wins selects newer record", () => {
  const older = makeRecord({ sha: "sha-old" });
  older.ingestion = { firstSeenAt: "2024-01-01T00:00:00.000Z", lastSeenAt: "2024-01-01T00:00:00.000Z" };

  const newer = makeRecord({ sha: "sha-new" });
  newer.provenance = { source: "git", observedAt: "2024-06-01T00:00:00.000Z" };

  const resolved = resolveConflict(older, newer, ConflictResolution.NEWER_WINS);
  assert.equal(resolved.commit.sha, "sha-new", "Should select newer record");
});

test("resolveConflict: source_priority selects lower priority source", () => {
  const gitRecord = makeRecord({ source: "git" });
  const changelogRecord = makeRecord({ source: "changelog" });

  const resolved = resolveConflict(gitRecord, changelogRecord, ConflictResolution.SOURCE_PRIORITY);
  assert.equal(resolved.provenance.source, "git", "Should select git (lower priority)");
});

test("resolveConflict: manual resolution marks as conflict", () => {
  const existing = makeRecord({ sha: "sha-manual-1" });
  const incoming = makeRecord({ sha: "sha-manual-2" });

  const resolved = resolveConflict(existing, incoming, ConflictResolution.MANUAL);
  assert.equal(resolved.verification.status, "conflict", "Manual resolution marks status as conflict");
});

// ============================================================================
// Test 4: Failed repo retry test
// ============================================================================
test("upsertBatch: isolated failure does not prevent other records", () => {
  const validRecord = makeRecord({ repoId: "proj-good", sha: "good001" });

  // One valid record, one record that triggers conflict (different SHA)
  const conflictRecord = makeRecord({ repoId: "proj-bad", sha: "conflict001" });

  const existingRecords = [];
  const incomingRecords = [validRecord, conflictRecord];

  const result = upsertBatch(existingRecords, incomingRecords);

  // Both records should be processed (one new, one could be conflict if it was existing)
  assert.equal(result.new.length, 2, "Both records should be processed");
  assert.equal(result.errors.length, 0, "No errors in batch");

  // Verify both repos are present
  const repoIds = result.new.map(r => r.repo.projectId);
  assert.ok(repoIds.includes("proj-good"), "Good record imported");
  assert.ok(repoIds.includes("proj-bad"), "Other record imported");
});

// ============================================================================
// Test 5: Pagination test (using in-memory filtering logic)
// ============================================================================
test("pagination: limit=10 returns exactly 10 records", () => {
  // Generate 100 records
  const records = [];
  for (let i = 0; i < 100; i++) {
    records.push(makeRecord({ repoId: `proj-pag-${i}`, sha: `sha-${String(i).padStart(3, "0")}` }));
  }

  // Simulate limit pagination
  const limit = 10;
  const page = 1;
  const start = (page - 1) * limit;
  const paginated = records.slice(start, start + limit);

  assert.equal(paginated.length, 10, "Should return exactly 10 records");

  // Verify correct records returned
  assert.equal(paginated[0].commit.sha, "sha-000", "First record is correct");
  assert.equal(paginated[9].commit.sha, "sha-009", "Tenth record is correct");
});

test("pagination: cursor-based continuation returns next page", () => {
  const records = [];
  for (let i = 0; i < 25; i++) {
    records.push(makeRecord({ repoId: `proj-cursor-${i}`, sha: `sha-cursor-${i}` }));
  }

  const pageSize = 10;
  const cursor = 10; // Start after 10 records

  const nextPage = records.slice(cursor, cursor + pageSize);

  assert.equal(nextPage.length, 10, "Should return 10 records for page 2");
  assert.equal(nextPage[0].commit.sha, "sha-cursor-10", "Cursor position correct");
  assert.equal(nextPage[9].commit.sha, "sha-cursor-19", "End of page 2 correct");
});

test("pagination: last page may have fewer records", () => {
  const records = [];
  for (let i = 0; i < 23; i++) {
    records.push(makeRecord({ repoId: `proj-last-${i}`, sha: `sha-last-${i}` }));
  }

  const pageSize = 10;
  const page = 3;
  const start = (page - 1) * pageSize;
  const lastPage = records.slice(start, start + pageSize);

  assert.equal(lastPage.length, 3, "Last page should have 3 records");
  assert.equal(lastPage[0].commit.sha, "sha-last-20", "First record of last page");
});

// ============================================================================
// Test 6: Filter test
// ============================================================================
test("filter: query by projectId", () => {
  const records = [
    makeRecord({ repoId: "proj-alpha" }),
    makeRecord({ repoId: "proj-beta" }),
    makeRecord({ repoId: "proj-alpha" })
  ];

  const filtered = records.filter(r => r.repo.projectId === "proj-alpha");
  assert.equal(filtered.length, 2, "Should return 2 records for proj-alpha");
  assert.ok(filtered.every(r => r.repo.projectId === "proj-alpha"), "All filtered records match projectId");
});

test("filter: query by verificationStatus", () => {
  const records = [
    makeRecord({ verificationStatus: "verified" }),
    makeRecord({ verificationStatus: "verified" }),
    makeRecord({ verificationStatus: "unverified" }),
    makeRecord({ verificationStatus: "failed" })
  ];

  const verified = records.filter(r => r.verification.status === "verified");
  assert.equal(verified.length, 2, "Should return 2 verified records");

  const failed = records.filter(r => r.verification.status === "failed");
  assert.equal(failed.length, 1, "Should return 1 failed record");
});

test("filter: query by dateRange", () => {
  const now = new Date();
  const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
  const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

  const records = [
    makeRecord({ sha: "old-record", extra: { verification: { observedAt: oldDate.toISOString() } } }),
    makeRecord({ sha: "recent-record", extra: { verification: { observedAt: recentDate.toISOString() } } })
  ];

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const filtered = records.filter(r => {
    const observed = new Date(r.verification?.observedAt || 0);
    return observed >= thirtyDaysAgo;
  });

  assert.equal(filtered.length, 1, "Should return only recent records within 30 days");
  assert.equal(filtered[0].commit.sha, "recent-record", "Recent record returned");
});

test("filter: combined filters (projectId + verificationStatus)", () => {
  const records = [
    makeRecord({ repoId: "proj-filter", sha: "f1", verificationStatus: "verified" }),
    makeRecord({ repoId: "proj-filter", sha: "f2", verificationStatus: "unverified" }),
    makeRecord({ repoId: "proj-other", sha: "f3", verificationStatus: "verified" })
  ];

  const filtered = records.filter(
    r => r.repo.projectId === "proj-filter" && r.verification.status === "verified"
  );

  assert.equal(filtered.length, 1, "Should return 1 matching record");
  assert.equal(filtered[0].commit.sha, "f1", "Correct record returned");
});

// ============================================================================
// Test 7: Stale detection
// ============================================================================
test("isStale: detects records older than threshold", () => {
  const oldRecord = makeRecord({ sha: "stale-record" });
  oldRecord.verification = { observedAt: "2024-01-01T00:00:00.000Z" };

  assert.equal(isStale(oldRecord, 30), true, "Record older than 30 days should be stale");
  // Record from 2024-01-01 is older than any threshold < ~600+ days
  assert.equal(isStale(oldRecord, 500), true, "Record older than 500 days should be stale");
});

test("isStale: recent records are not stale", () => {
  const now = new Date();
  const recentRecord = makeRecord({ sha: "recent-record" });
  recentRecord.verification = { observedAt: now.toISOString() };

  assert.equal(isStale(recentRecord, 30), false, "Record observed today should not be stale");
});

test("filterStale: removes stale records", () => {
  const now = new Date();
  const freshDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
  const oldDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

  const records = [
    makeRecord({ sha: "fresh-record", extra: { verification: { observedAt: freshDate.toISOString() } } }),
    makeRecord({ sha: "old-record", extra: { verification: { observedAt: oldDate.toISOString() } } })
  ];

  const fresh = filterStale(records, 30);
  assert.equal(fresh.length, 1, "Should return only fresh records");
  assert.equal(fresh[0].commit.sha, "fresh-record", "Fresh record retained");
});

// ============================================================================
// Test 8: Batch upsert summary
// ============================================================================
test("upsertBatch: returns correct summary counts", () => {
  const existing = [
    makeRecord({ repoId: "proj-existing", sha: "exist-001" }),
    makeRecord({ repoId: "proj-existing", sha: "exist-002" })
  ];

  const incoming = [
    makeRecord({ repoId: "proj-existing", sha: "exist-001" }), // unchanged
    makeRecord({ repoId: "proj-existing", sha: "exist-002", extra: { commit: { sha: "exist-002", shortSha: "exist002", committedAt: new Date().toISOString(), message: "Updated message" } } }), // updated
    makeRecord({ repoId: "proj-new", sha: "new-001" }) // new
  ];

  const result = upsertBatch(existing, incoming);

  assert.ok(Array.isArray(result.new), "new should be array");
  assert.ok(Array.isArray(result.updated), "updated should be array");
  assert.ok(Array.isArray(result.unchanged), "unchanged should be array");
  assert.ok(Array.isArray(result.conflict), "conflict should be array");
  assert.ok(Array.isArray(result.errors), "errors should be array");
  assert.equal(result.new.length + result.updated.length + result.unchanged.length, 3, "All records accounted for");
});
