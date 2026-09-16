/**
 * Commit Ledger Page
 * Axi Workbench Operations - Commit Ledger View
 *
 * Features:
 * - Workspace Commit Overview (summary stats)
 * - Project Dimension Table
 * - Commit Timeline (main table)
 * - Commit Detail View (Drawer)
 * - Filters (project, type, verification status, dirty, time range)
 * - States: Loading, Empty, Offline, Partial, Stale, Error, Unknown
 */

import React, { useMemo, useState } from 'react';
import { Button, Card, Drawer, Empty, Input, Select, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useCommitLedgerCommits, useCommitLedgerProjects, useCommitLedgerRecord, useCommitLedgerSummary, type CommitLedgerRecord } from '../../hooks/useCommitLedger';
import { ControlPlaneState } from '../admin/ControlPlaneState';
import { DesktopCrudFrame } from '../admin/DesktopCrudFrame';
import { desktopCrudPagination, DESKTOP_CRUD_PAGE_SIZE } from '../admin/tenantMemberCrud';
import { useI18n } from '../../i18n';
import './CommitLedger.css';

const { Text, Paragraph } = Typography;

// ============================================================
// Types
// ============================================================

type CommitLedgerFilters = {
  projectId?: string;
  type?: string;
  verificationStatus?: string;
  isDirty?: boolean | null;
};

type CommitRow = {
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

type ProjectRow = {
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

// ============================================================
// Constants
// ============================================================

const TYPE_COLORS: Record<string, string> = {
  feat: 'blue',
  fix: 'red',
  docs: 'cyan',
  style: 'default',
  refactor: 'purple',
  perf: 'orange',
  test: 'green',
  chore: 'default',
  build: 'cyan',
  ci: 'blue',
  revert: 'orange',
  wip: 'gold',
  merge: 'default',
  unknown: 'default',
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  verified: { color: 'green', icon: <CheckCircleOutlined />, label: '已验证' },
  partial: { color: 'orange', icon: <WarningOutlined />, label: '部分验证' },
  unverified: { color: 'default', icon: <InfoCircleOutlined />, label: '未验证' },
  failed: { color: 'red', icon: <CloseCircleOutlined />, label: '验证失败' },
  conflict: { color: 'purple', icon: <ExclamationCircleOutlined />, label: '冲突' },
  stale: { color: 'gold', icon: <ClockCircleOutlined />, label: '过时' },
  unknown: { color: 'default', icon: null, label: '未知' },
};

const COMMIT_TYPES = [
  { value: 'feat', label: 'feat' },
  { value: 'fix', label: 'fix' },
  { value: 'docs', label: 'docs' },
  { value: 'style', label: 'style' },
  { value: 'refactor', label: 'refactor' },
  { value: 'perf', label: 'perf' },
  { value: 'test', label: 'test' },
  { value: 'chore', label: 'chore' },
  { value: 'build', label: 'build' },
  { value: 'ci', label: 'ci' },
  { value: 'revert', label: 'revert' },
];

const VERIFICATION_STATUSES = [
  { value: 'verified', label: '已验证' },
  { value: 'partial', label: '部分验证' },
  { value: 'unverified', label: '未验证' },
  { value: 'failed', label: '验证失败' },
];

const DIRTY_OPTIONS = [
  { value: 'true', label: 'Dirty' },
  { value: 'false', label: 'Clean' },
];

// ============================================================
// Helper Functions
// ============================================================

function formatTime(value: string | undefined, locale: string = 'zh-CN'): string {
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

function formatRelativeTime(value: string | undefined): string {
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

function recordToCommitRow(record: CommitLedgerRecord): CommitRow {
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

function filterByKeyword<T>(
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

// ============================================================
// Components
// ============================================================

function SummaryCards({
  summary,
  loading,
  onRefresh,
  isFetching
}: {
  summary?: {
    totalProjects: number;
    totalCommits: number;
    verifiedCommits: number;
    unverifiedCommits: number;
    dirtyWorkspaces: number;
    conflictRecords: number;
    lastUpdated?: string;
  };
  loading: boolean;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const { t } = useI18n();

  if (loading && !summary) {
    return (
      <div className="commit-ledger-summary-cards">
        <Card size="small" className="summary-card">
          <Spin size="small" />
        </Card>
      </div>
    );
  }

  if (!summary) return null;

  const coverage = summary.totalCommits > 0
    ? Math.round((summary.verifiedCommits / summary.totalCommits) * 100)
    : 0;

  return (
    <div className="commit-ledger-summary-cards">
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.projects') || '项目数'}</div>
        <div className="stat-value">{summary.totalProjects}</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.totalCommits') || '提交总数'}</div>
        <div className="stat-value">{summary.totalCommits}</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.recentCommits') || '最近提交'}</div>
        <div className="stat-value">{formatRelativeTime(summary.lastUpdated)}</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.verified') || '已验证'}</div>
        <div className="stat-value success">{summary.verifiedCommits}</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.unverified') || '未验证'}</div>
        <div className="stat-value warning">{summary.unverifiedCommits}</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.coverage') || '覆盖率'}</div>
        <div className="stat-value">{coverage}%</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.dirty') || 'Dirty'}</div>
        <div className="stat-value error">{summary.dirtyWorkspaces}</div>
      </Card>
      <Card size="small" className="summary-card">
        <div className="stat-label">{t('commitLedger.summary.conflicts') || '冲突'}</div>
        <div className="stat-value error">{summary.conflictRecords}</div>
      </Card>
      <Card size="small" className="summary-card summary-card--refresh">
        <Button
          icon={<ReloadOutlined spin={isFetching} />}
          onClick={onRefresh}
          loading={isFetching}
          size="small"
        >
          {t('common.refresh') || '刷新'}
        </Button>
      </Card>
    </div>
  );
}

function CommitDetailDrawer({
  recordId,
  open,
  onClose,
}: {
  recordId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { data: record, isLoading } = useCommitLedgerRecord(recordId ?? undefined);

  return (
    <Drawer
      title={t('commitLedger.detail.title') || '提交详情'}
      placement="right"
      width={600}
      onClose={onClose}
      open={open}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin />
        </div>
      ) : record ? (
        <div className="commit-detail">
          {/* SHA */}
          <div className="detail-section">
            <label className="detail-label">SHA</label>
            <div className="detail-value">
              <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{record.commit.sha}</code>
            </div>
          </div>

          {/* Parent SHAs */}
          {record.commit.parentShas?.length > 0 && (
            <div className="detail-section">
              <label className="detail-label">Parent</label>
              <div className="detail-value">
                {record.commit.parentShas.map((sha, i) => (
                  <code key={i} style={{ fontSize: 12, marginRight: 8 }}>{sha.slice(0, 8)}</code>
                ))}
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.subject') || 'Subject'}</label>
            <Text strong className="detail-value">{record.commit.subject}</Text>
          </div>

          {/* Body */}
          {record.commit.body && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.body') || 'Body'}</label>
              <Paragraph className="detail-value" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {record.commit.body}
              </Paragraph>
            </div>
          )}

          {/* Type / Scope */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.type') || 'Type'}</label>
            <div className="detail-value">
              <Tag color={TYPE_COLORS[record.commit.type] || 'default'}>
                {record.commit.type}
                {record.commit.scope && `:${record.commit.scope}`}
              </Tag>
              {record.commit.breaking && <Tag color="red">BREAKING</Tag>}
            </div>
          </div>

          {/* Author / Committer */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.author') || 'Author'}</label>
            <div className="detail-value">
              {record.actor.name}
              {record.actor.email && <span style={{ color: '#888', marginLeft: 8 }}>&lt;{record.actor.email}&gt;</span>}
            </div>
          </div>

          {/* Times */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.times') || '时间'}</label>
            <div className="detail-value">
              <div>{t('commitLedger.detail.authoredAt') || 'Authored'}: {formatTime(record.commit.authoredAt)}</div>
              <div>{t('commitLedger.detail.committedAt') || 'Committed'}: {formatTime(record.commit.committedAt)}</div>
            </div>
          </div>

          {/* Branch / Tags */}
          {record.refs && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.refs') || 'Refs'}</label>
              <div className="detail-value">
                {record.refs.branches?.map((b, i) => (
                  <Tag key={`b-${i}`} color="blue">{b}</Tag>
                ))}
                {record.refs.tags?.map((t2, i) => (
                  <Tag key={`t-${i}`} color="green">{t2}</Tag>
                ))}
              </div>
            </div>
          )}

          {/* Diff Stat */}
          {record.diff && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.diff') || 'Diff'}</label>
              <div className="detail-value">
                <Tag icon={<CodeOutlined />} color="blue">
                  {record.diff.filesChanged ?? 0} files
                </Tag>
                <Tag color="green">+{record.diff.insertions ?? 0}</Tag>
                <Tag color="red">-{record.diff.deletions ?? 0}</Tag>
              </div>
            </div>
          )}

          {/* Workspace State */}
          {record.workspaceState && (
            <div className="detail-section">
              <label className="detail-label">{t('commitLedger.detail.workspace') || '工作区'}</label>
              <div className="detail-value">
                <div>
                  {t('commitLedger.detail.branch') || 'Branch'}: {record.workspaceState.observedBranch ?? '—'}
                </div>
                <div>
                  {t('commitLedger.detail.dirty') || 'Dirty'}:
                  {record.workspaceState.isDirty ? (
                    <Tag color="red">{t('common.yes') || '是'}</Tag>
                  ) : (
                    <Tag color="green">{t('common.no') || '否'}</Tag>
                  )}
                </div>
                {record.workspaceState.ahead !== undefined && (
                  <div>
                    {t('commitLedger.detail.ahead') || 'Ahead'}: {record.workspaceState.ahead}
                  </div>
                )}
                {record.workspaceState.behind !== undefined && (
                  <div>
                    {t('commitLedger.detail.behind') || 'Behind'}: {record.workspaceState.behind}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verification */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.verification') || '验证'}</label>
            <div className="detail-value">
              {(() => {
                const config = STATUS_CONFIG[record.verification?.status ?? 'unknown'];
                return (
                  <Tag color={config.color} icon={config.icon}>
                    {config.label}
                  </Tag>
                );
              })()}
            </div>
            {record.verification?.commands && record.verification.commands.length > 0 && (
              <div className="detail-subvalue">
                <label>{t('commitLedger.detail.commands') || 'Commands'}:</label>
                <ul>
                  {record.verification.commands.map((cmd, i) => (
                    <li key={i}><code>{cmd}</code></li>
                  ))}
                </ul>
              </div>
            )}
            {record.verification?.evidenceRefs && record.verification.evidenceRefs.length > 0 && (
              <div className="detail-subvalue">
                <label>{t('commitLedger.detail.evidence') || 'Evidence'}:</label>
                <ul>
                  {record.verification.evidenceRefs.map((ref, i) => (
                    <li key={i}><Text code copyable>{ref}</Text></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Provenance */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.provenance') || '来源'}</label>
            <div className="detail-value">
              <div>Source: {record.provenance.source}</div>
              <div style={{ fontSize: 12, wordBreak: 'break-all', color: '#666' }}>
                {record.provenance.sourcePath}
              </div>
              {record.provenance.sourceCommand && (
                <div><code style={{ fontSize: 11 }}>{record.provenance.sourceCommand}</code></div>
              )}
              {record.provenance.sourceHash && (
                <div style={{ fontSize: 11, color: '#888' }}>
                  Hash: {record.provenance.sourceHash.slice(0, 8)}
                </div>
              )}
            </div>
          </div>

          {/* Ingestion */}
          <div className="detail-section">
            <label className="detail-label">{t('commitLedger.detail.ingestion') || '摄取'}</label>
            <div className="detail-value">
              <div>Status: {record.ingestion.status}</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {t('commitLedger.detail.firstSeen') || 'First seen'}: {formatTime(record.ingestion.firstSeenAt)}
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {t('commitLedger.detail.lastSeen') || 'Last seen'}: {formatTime(record.ingestion.lastSeenAt)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Empty description={t('commitLedger.detail.notFound') || '记录不存在'} />
      )}
    </Drawer>
  );
}

// ============================================================
// Main Component
// ============================================================

export function CommitLedgerPage() {
  const { t } = useI18n();

  // State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DESKTOP_CRUD_PAGE_SIZE);
  const [filters, setFilters] = useState<CommitLedgerFilters>({});
  const [keywordDraft, setKeywordDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Data fetching
  const {
    data: summaryData,
    isFetching: isFetchingSummary,
    isLoading: isLoadingSummary,
    isError: isErrorSummary,
    refetch: refetchSummary
  } = useCommitLedgerSummary();

  const {
    data: commitsData,
    isFetching: isFetchingCommits,
    isLoading: isLoadingCommits,
    isError: isErrorCommits
  } = useCommitLedgerCommits(page, limit, {
      ...filters,
      isDirty: filters.isDirty === null ? undefined : filters.isDirty,
    });

  const { data: projectsData } = useCommitLedgerProjects();

  // Derived state
  const summary = summaryData?.workspace;
  const commits = commitsData?.data ?? [];
  const pagination = commitsData?.pagination;
  const projectOptions = useMemo(() => {
    if (!projectsData?.projects) return [];
    return projectsData.projects.map((p) => ({
      value: p.projectId,
      label: p.projectId,
    }));
  }, [projectsData]);

  // Filter by keyword
  const filteredCommits = useMemo(
    () => filterByKeyword(commits.map(recordToCommitRow), keyword, (row) => [
      row.subject,
      row.authorName,
      row.projectId,
      row.shortSha,
      row.type,
      row.scope,
    ]),
    [commits, keyword],
  );

  // Table columns
  const commitColumns: AxiTableColumn<CommitRow>[] = [
    {
      dataIndex: 'committedAt',
      title: t('commitLedger.column.time') || '时间',
      width: 150,
      render: (value) => (
        <Tooltip title={formatTime(value)}>
          <span style={{ fontSize: 12 }}>{formatRelativeTime(value)}</span>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'projectId',
      title: t('commitLedger.column.project') || '项目',
      width: 150,
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
    {
      dataIndex: 'shortSha',
      title: 'SHA',
      width: 90,
      render: (value, row) => (
        <Tooltip title={row.sha}>
          <code
            style={{ cursor: 'pointer', fontSize: 12 }}
            onClick={() => {
              setSelectedRecordId(row.recordId);
              setDrawerOpen(true);
            }}
          >
            {value}
          </code>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'type',
      title: t('commitLedger.column.type') || '类型',
      width: 100,
      render: (value, row) => (
        <Space>
          <Tag color={TYPE_COLORS[value] || 'default'}>{value}</Tag>
          {row.breaking && <Tag color="red" style={{ fontSize: 10 }}>!</Tag>}
        </Space>
      ),
    },
    {
      dataIndex: 'subject',
      title: t('commitLedger.column.subject') || 'Subject',
      ellipsis: true,
      render: (value) => (
        <Tooltip title={value}>
          <span>{value}</span>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'authorName',
      title: t('commitLedger.column.author') || '作者',
      width: 120,
    },
    {
      dataIndex: 'verificationStatus',
      title: t('commitLedger.column.verified') || '验证',
      width: 100,
      render: (value) => {
        const config = STATUS_CONFIG[value] || STATUS_CONFIG.unknown;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      dataIndex: 'isDirty',
      title: t('commitLedger.column.dirty') || 'Dirty',
      width: 80,
      render: (value) => {
        if (value === null) return <Tag>—</Tag>;
        return value ? (
          <Tag color="red">Dirty</Tag>
        ) : (
          <Tag color="green">Clean</Tag>
        );
      },
    },
    {
      dataIndex: 'evidenceCount',
      title: t('commitLedger.column.evidence') || '证据',
      width: 70,
      render: (value) => (
        <span style={{ color: value > 0 ? '#52c41a' : '#999' }}>
          {value > 0 ? `${value}` : '—'}
        </span>
      ),
    },
  ];

  // Project columns (for dimension table)
  const projectColumns: AxiTableColumn<ProjectRow>[] = [
    {
      dataIndex: 'projectId',
      title: t('commitLedger.column.project') || '项目',
      width: 150,
    },
    {
      dataIndex: 'canonicalPath',
      title: t('commitLedger.column.path') || '路径',
      ellipsis: true,
      render: (value) => (
        <Tooltip title={value}>
          <code style={{ fontSize: 11 }}>{value}</code>
        </Tooltip>
      ),
    },
    {
      dataIndex: 'branch',
      title: t('commitLedger.column.branch') || '分支',
      width: 120,
    },
    {
      dataIndex: 'head',
      title: 'HEAD',
      width: 80,
      render: (value) => value ? <code style={{ fontSize: 11 }}>{value.slice(0, 7)}</code> : '—',
    },
    {
      dataIndex: 'ahead',
      title: t('commitLedger.column.ahead') || 'Ahead',
      width: 70,
      render: (value) => value ? <span style={{ color: value > 0 ? '#fa8c16' : undefined }}>+{value}</span> : '—',
    },
    {
      dataIndex: 'behind',
      title: t('commitLedger.column.behind') || 'Behind',
      width: 70,
      render: (value) => value ? <span style={{ color: value > 0 ? '#1890ff' : undefined }}>-{value}</span> : '—',
    },
    {
      dataIndex: 'isDirty',
      title: t('commitLedger.column.dirty') || 'Dirty',
      width: 70,
      render: (value) => value ? (
        <Tag color="red">Dirty</Tag>
      ) : (
        <Tag color="green">Clean</Tag>
      ),
    },
    {
      dataIndex: 'commitCount',
      title: t('commitLedger.column.commits') || '提交',
      width: 70,
      align: 'right' as const,
    },
    {
      dataIndex: 'verificationStatus',
      title: t('commitLedger.column.verified') || '验证',
      width: 100,
      render: (value) => {
        const config = STATUS_CONFIG[value] || STATUS_CONFIG.unknown;
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
  ];

  // Build project rows from summary
  const projectRows = useMemo<ProjectRow[]>(() => {
    if (!projectsData?.projects || !summary) return [];
    // This would ideally come from a dedicated endpoint, but we derive from summary
    return projectsData.projects.map((p) => ({
      projectId: p.projectId,
      canonicalPath: '', // Would come from project details
      branch: undefined,
      head: undefined,
      ahead: undefined,
      behind: undefined,
      isDirty: false,
      lastCommitAt: p.lastCommit,
      verificationStatus: 'unverified',
      commitCount: p.commitCount,
    }));
  }, [projectsData, summary]);

  // Actions
  const runSearch = () => setKeyword(keywordDraft.trim());
  const handleFilterChange = (key: keyof CommitLedgerFilters, value: string | boolean | null) => {
    setPage(1);
    setFilters((prev) => {
      if (value === null || value === '' || (typeof value === 'boolean' && value === null)) {
        const { [key]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  };
  const handleRowClick = (record: CommitRow) => {
    setSelectedRecordId(record.recordId);
    setDrawerOpen(true);
  };

  // State detection
  const showError = (isErrorSummary || isErrorCommits) && !summary && !commits.length;
  const showLoading = (isLoadingSummary || isLoadingCommits) && !summary && !commits.length;
  const showEmpty = !showLoading && !showError && commits.length === 0 && summary;

  // Get pagination config
  const tablePagination = useMemo(() => {
    if (!pagination) return false;
    return {
      ...desktopCrudPagination(pagination.total),
      current: page,
      pageSize: limit,
      onChange: (newPage: number, newLimit: number) => {
        setPage(newPage);
        setLimit(newLimit);
      },
    };
  }, [pagination, page, limit]);

  return (
    <DesktopCrudFrame
      ariaLabel={t('commitLedger.title') || 'Commit Ledger'}
      className="commit-ledger-crud"
      search={!showError && !showLoading ? (
        <div className="wb-crud-search-cluster">
          <Input
            allowClear
            aria-label={t('commitLedger.search.ariaLabel') || 'Search commits'}
            placeholder={t('commitLedger.search.placeholder') || 'Search subject, author, SHA...'}
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            onClear={() => { setKeywordDraft(''); setKeyword(''); }}
            onPressEnter={runSearch}
          />
          <Button type="primary" onClick={runSearch}>{t('common.search') || '搜索'}</Button>
        </div>
      ) : undefined}
      filters={!showError && !showLoading ? (
        <Space wrap>
          <Select
            allowClear
            aria-label={t('commitLedger.filter.project') || 'Filter by project'}
            placeholder={t('commitLedger.filter.project') || '项目'}
            style={{ minWidth: 150 }}
            value={filters.projectId}
            onChange={(val) => handleFilterChange('projectId', val ?? null)}
            options={projectOptions}
          />
          <Select
            allowClear
            aria-label={t('commitLedger.filter.type') || 'Filter by type'}
            placeholder={t('commitLedger.filter.type') || '类型'}
            style={{ minWidth: 120 }}
            value={filters.type}
            onChange={(val) => handleFilterChange('type', val ?? null)}
            options={COMMIT_TYPES}
          />
          <Select
            allowClear
            aria-label={t('commitLedger.filter.status') || 'Filter by verification status'}
            placeholder={t('commitLedger.filter.status') || '验证状态'}
            style={{ minWidth: 120 }}
            value={filters.verificationStatus}
            onChange={(val) => handleFilterChange('verificationStatus', val ?? null)}
            options={VERIFICATION_STATUSES}
          />
          <Select
            allowClear
            aria-label={t('commitLedger.filter.dirty') || 'Filter by dirty state'}
            placeholder={t('commitLedger.filter.dirty') || 'Dirty'}
            style={{ minWidth: 100 }}
            value={filters.isDirty === undefined ? undefined : String(filters.isDirty)}
            onChange={(val) => handleFilterChange('isDirty', val === undefined ? null : val === 'true')}
            options={DIRTY_OPTIONS}
          />
        </Space>
      ) : undefined}
      top={!showError && !showLoading ? (
        <div className="wb-crud-action-cluster">
          <Button
            loading={isFetchingSummary || isFetchingCommits}
            onClick={() => void refetchSummary()}
          >
            {t('common.refresh') || '刷新'}
          </Button>
        </div>
      ) : undefined}
    >
      {showError ? (
        <ControlPlaneState
          actionLabel={t('common.retry') || '重试'}
          actionLoading={isFetchingSummary}
          description={t('commitLedger.error.description') || '无法加载提交账本数据'}
          title={t('commitLedger.error.title') || '加载失败'}
          onAction={() => void refetchSummary()}
        />
      ) : showLoading ? (
        <ControlPlaneState
          description={t('commitLedger.loading.description') || '正在加载提交账本...'}
          loading
          title={t('commitLedger.loading.title') || '加载中'}
        />
      ) : (
        <div className="commit-ledger-grid">
          {/* Summary Cards */}
          <SummaryCards
            summary={summary}
            loading={isLoadingSummary}
            onRefresh={() => void refetchSummary()}
            isFetching={isFetchingSummary}
          />

          {/* Main Content */}
          <div className="commit-ledger-main">
            {/* Commit Timeline Table */}
            <AxiTableGroup
              className="commit-ledger-timeline"
              description={
                filteredCommits.length !== commits.length
                  ? `${filteredCommits.length}/${commits.length}${t('commitLedger.table.filtered') || '条记录'}`
                  : `${commits.length}${t('commitLedger.table.records') || '条记录'}`
              }
              title={t('commitLedger.timeline.title') || '提交时间线'}
            >
              <AxiTable
                columns={commitColumns}
                data={filteredCommits}
                loading={isFetchingCommits && !commits.length}
                pagination={tablePagination}
                rowKey="recordId"
                size="small"
                onRow={(row) => ({
                  onClick: () => handleRowClick(row),
                  style: { cursor: 'pointer' },
                })}
              />
            </AxiTableGroup>

            {/* Empty State */}
            {showEmpty && (
              <div className="commit-ledger-empty">
                <Empty
                  description={t('commitLedger.empty.description') || '暂无提交记录'}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commit Detail Drawer */}
      <CommitDetailDrawer
        recordId={selectedRecordId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </DesktopCrudFrame>
  );
}

export default CommitLedgerPage;
