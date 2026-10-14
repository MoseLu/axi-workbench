/**
 * Commit Ledger — pure view helpers.
 *
 * Extracted verbatim from `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4).
 */

import type { CommitLedgerRecord } from '../../../hooks/useCommitLedger';
import type { CommitRow } from './types';

export function formatTime(value: string | undefined, locale: string = 'zh-CN'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeTime(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return formatTime(value);
}

export function recordToCommitRow(record: CommitLedgerRecord): CommitRow {
  return {
    recordId: record.recordId,
    committedAt: record.commit.committedAt,
    projectId: record.repo.projectId,
    canonicalPath: record.repo.canonicalPath,
    shortSha: record.commit.shortSha,
    sha: record.commit.sha,
    type: record.commit.type,
    scope: record.commit.scope,
    breaking: record.commit.breaking,
    subject: record.commit.subject,
    body: record.commit.body,
    authorName: record.actor.name,
    authorEmail: record.actor.email,
    verificationStatus: record.verification?.status ?? 'unknown',
    isDirty: record.workspaceState?.isDirty ?? null,
    ahead: record.workspaceState?.ahead,
    behind: record.workspaceState?.behind,
    evidenceCount: record.verification?.evidenceRefs?.length ?? 0,
    filesChanged: record.diff?.filesChanged,
    insertions: record.diff?.insertions,
    deletions: record.diff?.deletions,
  };
}

export function filterByKeyword<T>(
  rows: T[],
  keyword: string,
  fields: (row: T) => Array<string | undefined | null>,
): T[] {
  const normalized = keyword.trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return rows;
  return rows.filter((row) => fields(row)
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('zh-CN')
    .includes(normalized));
}
