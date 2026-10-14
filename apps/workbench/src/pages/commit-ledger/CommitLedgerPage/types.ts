/**
 * Commit Ledger — shared view-model types.
 *
 * Extracted verbatim from `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4) so the page entry and its sub-components share a
 * single definition.
 */

export type CommitLedgerFilters = {
  projectId?: string;
  type?: string;
  verificationStatus?: string;
  isDirty?: boolean | null;
};

export type CommitRow = {
  recordId: string;
  committedAt: string;
  projectId: string;
  canonicalPath: string;
  shortSha: string;
  sha: string;
  type: string;
  scope?: string;
  breaking: boolean;
  subject: string;
  body?: string;
  authorName: string;
  authorEmail?: string;
  verificationStatus: string;
  isDirty: boolean | null;
  ahead?: number;
  behind?: number;
  evidenceCount: number;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
};

export type ProjectRow = {
  projectId: string;
  canonicalPath: string;
  branch?: string;
  head?: string;
  ahead?: number;
  behind?: number;
  isDirty: boolean;
  lastCommitAt?: string;
  verificationStatus: string;
  commitCount: number;
};
