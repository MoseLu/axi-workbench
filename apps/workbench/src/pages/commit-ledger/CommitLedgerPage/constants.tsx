/**
 * Commit Ledger — view constants.
 *
 * Extracted verbatim from `CommitLedgerPage.tsx` during the 2026-10-14
 * architecture sweep (W4). Values (colors, labels, option lists) are unchanged.
 */

import React from 'react';
// axi-ui-escape-hatch: @ant-design/icons 暂时保留 — STATUS_CONFIG 需要「验证状态 →
// 图标节点」映射，@axi/ui / @axi/widgets 暂无等价的状态图标 primitive。沿用原
// CommitLedgerPage.tsx 的 Cool Admin 历史图标集，等 AxiStatusTag 之类组件上线后再
// 替换。
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';

export const TYPE_COLORS: Record<string, string> = {
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

export const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  verified: { color: 'green', icon: <CheckCircleOutlined />, label: '已验证' },
  partial: { color: 'orange', icon: <WarningOutlined />, label: '部分验证' },
  unverified: { color: 'default', icon: <InfoCircleOutlined />, label: '未验证' },
  failed: { color: 'red', icon: <CloseCircleOutlined />, label: '验证失败' },
  conflict: { color: 'purple', icon: <ExclamationCircleOutlined />, label: '冲突' },
  stale: { color: 'gold', icon: <ClockCircleOutlined />, label: '过时' },
  unknown: { color: 'default', icon: null, label: '未知' },
};

export const COMMIT_TYPES = [
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

export const VERIFICATION_STATUSES = [
  { value: 'verified', label: '已验证' },
  { value: 'partial', label: '部分验证' },
  { value: 'unverified', label: '未验证' },
  { value: 'failed', label: '验证失败' },
];

export const DIRTY_OPTIONS = [
  { value: 'true', label: 'Dirty' },
  { value: 'false', label: 'Clean' },
];
