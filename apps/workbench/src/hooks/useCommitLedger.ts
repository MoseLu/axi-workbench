/**
 * Commit Ledger API Hooks
 * React Query hooks for commit-ledger data fetching
 */

import { useQuery } from '@tanstack/react-query';

// Types based on commit-ledger.v1.schema.json
export interface CommitLedgerRecord {
  schemaVersion: 'commit-ledger.v1';
  recordId: string;
  repo: {
    projectId: string;
    canonicalPath: string;
    gitRoot: string;
    remote?: string;
    defaultBranch: string;
  };
  commit: {
    sha: string;
    shortSha: string;
    parentShas: string[];
    subject: string;
    body?: string;
    type: string;
    scope?: string;
    breaking: boolean;
    authoredAt: string;
    committedAt: string;
  };
  actor: {
    name: string;
    email?: string;
  };
  refs?: {
    branches?: string[];
    tags?: string[];
  };
  diff?: {
    filesChanged?: number;
    insertions?: number;
    deletions?: number;
  };
  workspaceState?: {
    observedBranch?: string;
    isDirty?: boolean;
    ahead?: number;
    behind?: number;
    observedAt?: string;
  };
  verification?: {
    status: string;
    commands?: string[];
    evidenceRefs?: string[];
    observedAt?: string;
  };
  provenance: {
    source: string;
    sourcePath: string;
    sourceCommand?: string;
    sourceHash?: string;
    observedAt: string;
  };
  ingestion: {
    idempotencyKey: string;
    firstSeenAt: string;
    lastSeenAt: string;
    status: string;
  };
}

export interface CommitLedgerSummary {
  totalProjects: number;
  totalCommits: number;
  verifiedCommits: number;
  unverifiedCommits: number;
  dirtyWorkspaces: number;
  conflictRecords: number;
  lastUpdated: string;
}

export interface CommitLedgerPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CommitLedgerFilters {
  projectId?: string;
  type?: string;
  verificationStatus?: string;
  isDirty?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface CommitLedgerCommitsResponse {
  data: CommitLedgerRecord[];
  pagination: CommitLedgerPagination;
}

/**
 * Fetch commit ledger summary
 */
export function useCommitLedgerSummary() {
  return useQuery<{ workspace: CommitLedgerSummary }>({
    queryKey: ['commit-ledger', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/v1/commit-ledger/summary');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch commit ledger commits with pagination and filters
 */
export function useCommitLedgerCommits(
  page: number = 1,
  limit: number = 50,
  filters: CommitLedgerFilters = {}
) {
  return useQuery<CommitLedgerCommitsResponse>({
    queryKey: ['commit-ledger', 'commits', page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (filters.projectId) params.set('projectId', filters.projectId);
      if (filters.type) params.set('type', filters.type);
      if (filters.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
      if (filters.isDirty !== undefined) params.set('isDirty', String(filters.isDirty));
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await fetch(`/api/v1/commit-ledger/commits?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

/**
 * Fetch a single commit ledger record by recordId
 */
export function useCommitLedgerRecord(recordId: string | undefined) {
  return useQuery<CommitLedgerRecord>({
    queryKey: ['commit-ledger', 'record', recordId],
    queryFn: async () => {
      if (!recordId) throw new Error('recordId is required');
      const res = await fetch(`/api/v1/commit-ledger/records/${recordId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!recordId,
  });
}

/**
 * Fetch verification status for a specific commit
 */
export function useCommitLedgerVerification(recordId: string | undefined) {
  return useQuery<{ status: string; commands?: string[]; evidenceRefs?: string[] }>({
    queryKey: ['commit-ledger', 'verification', recordId],
    queryFn: async () => {
      if (!recordId) throw new Error('recordId is required');
      const res = await fetch(`/api/v1/commit-ledger/records/${recordId}/verification`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!recordId,
  });
}

/**
 * Fetch commit ledger data sources
 */
export function useCommitLedgerSources() {
  return useQuery<{ sources: Array<{ source: string; count: number; lastSeen: string }> }>({
    queryKey: ['commit-ledger', 'sources'],
    queryFn: async () => {
      const res = await fetch('/api/v1/commit-ledger/sources');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}

/**
 * Fetch projects that have commit ledger records
 */
export function useCommitLedgerProjects() {
  return useQuery<{ projects: Array<{ projectId: string; commitCount: number; lastCommit: string }> }>({
    queryKey: ['commit-ledger', 'projects'],
    queryFn: async () => {
      const res = await fetch('/api/v1/commit-ledger/projects');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
}
