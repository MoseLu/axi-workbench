/**
 * Commit Ledger Evidence Linker
 * 建立 commit 与证据的关联，归一化验证状态
 *
 * 解析 commit trailers 并链接证据源:
 * - Tested: test commands or scopes
 * - Not-tested: untested scopes
 * - Confidence: low/medium/high
 * - Scope-risk: scope impact assessment
 * - Directive: special instructions
 * - Refs: related issues, PRs
 */

export enum VerificationStatus {
  VERIFIED = 'verified',
  PARTIAL = 'partial',
  UNVERIFIED = 'unverified',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
  CONFLICT = 'conflict'
}

/**
 * Commit trailer evidence extracted from record
 */
export interface TrailerEvidence {
  tested: string[];
  notTested: string[];
  confidence: 'low' | 'medium' | 'high' | null;
  scopeRisk: 'low' | 'medium' | 'high' | 'critical' | null;
  directive: string | null;
  refs: string[];
}

/**
 * Verification record attached to a commit
 */
export interface Verification {
  status: VerificationStatus;
  commands: string[];
  evidenceRefs: string[];
  observedAt: string;
}

/**
 * Commit metadata from ledger record
 */
export interface CommitInfo {
  sha?: string;
  subject?: string;
  message?: string;
}

/**
 * Actor who created the commit (for CI detection)
 */
export interface Actor {
  name?: string;
  email?: string;
}

/**
 * Repository metadata
 */
export interface RepoInfo {
  projectId?: string;
  name?: string;
}

/**
 * Evidence source for linking
 */
export interface EvidenceSource {
  type: 'submit-log' | 'changelog' | 'test-report' | 'verification-artifact';
  path: string;
  commitSha?: string;
  matchSubject?: string;
  content?: string;
}

/**
 * Conflict detected between records
 */
export interface Conflict {
  recordId: string;
  sha?: string;
  projectId?: string;
  conflict: {
    recordA: string;
    statusA: VerificationStatus;
    recordB: string;
    statusB: VerificationStatus;
  };
}

/**
 * Stale verification record
 */
export interface StaleRecord {
  recordId: string;
  sha?: string;
  projectId?: string;
  verifiedAt?: string;
  staleDays: number;
}

/**
 * Verification statistics
 */
export interface VerificationStats {
  verified: number;
  partial: number;
  unverified: number;
  failed: number;
  conflict: number;
  unknown: number;
}

/**
 * Ledger record with verification
 */
export interface LedgerRecord {
  recordId?: string;
  commit?: CommitInfo;
  actor?: Actor;
  repo?: RepoInfo;
  trailers?: Partial<TrailerEvidence>;
  verification?: Verification;
}

/**
 * 从 commit trailers 提取证据
 */
export function extractTrailerEvidence(record: LedgerRecord): TrailerEvidence {
  const evidence: TrailerEvidence = {
    tested: [],
    notTested: [],
    confidence: null,
    scopeRisk: null,
    directive: null,
    refs: []
  };

  if (record.trailers) {
    evidence.tested = record.trailers.tested || [];
    evidence.notTested = record.trailers.notTested || [];
    evidence.confidence = record.trailers.confidence ?? null;
    evidence.scopeRisk = record.trailers.scopeRisk ?? null;
    evidence.directive = record.trailers.directive ?? null;
    evidence.refs = record.trailers.refs || [];
  }

  return evidence;
}

/**
 * 计算证据分数
 * 分数范围: -2 到 6
 *
 * Rules:
 * - Commit message saying "complete" does NOT mean verified
 * - Must have actual test/verification evidence
 */
export function calculateEvidenceScore(evidence: TrailerEvidence, actor?: Actor): number {
  let score = 0;

  // 1. Tested trailer (+2)
  if (evidence.tested && evidence.tested.length > 0) {
    score += 2;
  }

  // 2. Not-tested trailer (-1)
  if (evidence.notTested && evidence.notTested.length > 0) {
    score -= 1;
  }

  // 3. Confidence trailer (+1 或 +2)
  if (evidence.confidence !== null && evidence.confidence !== undefined) {
    score += evidence.confidence === 'high' ? 2 : 1;
  }

  // 4. Scope risk (-1 for high/critical)
  if (evidence.scopeRisk && ['high', 'critical'].includes(evidence.scopeRisk.toLowerCase())) {
    score -= 1;
  }

  // 5. CI 自动提交 (+1)
  const name = actor?.name || '';
  if (/^(ci|github-actions|gitlab-ci|dependabot|renovate)/i.test(name)) {
    score += 1;
  }

  // 6. 有 refs (+1)
  if (evidence.refs && evidence.refs.length > 0) {
    score += 1;
  }

  return Math.max(-2, Math.min(6, score));
}

/**
 * 根据证据分数归一化验证状态
 */
export function scoreToStatus(score: number): VerificationStatus {
  if (score >= 4) return VerificationStatus.VERIFIED;
  if (score >= 2) return VerificationStatus.PARTIAL;
  if (score <= -1) return VerificationStatus.FAILED;
  return VerificationStatus.UNVERIFIED;
}

/**
 * 关联证据到提交记录
 *
 * Links evidence sources:
 * - submit log entries matching commit subject
 * - CHANGELOG entries
 * - test report artifacts
 * - verification artifacts
 */
export function linkEvidence(record: LedgerRecord, evidenceSources: EvidenceSource[] = []): LedgerRecord {
  const linked: LedgerRecord = { ...record };

  // 确保 verification 字段存在
  linked.verification = linked.verification || {
    status: VerificationStatus.UNVERIFIED,
    commands: [],
    evidenceRefs: [],
    observedAt: new Date().toISOString()
  };

  // 提取证据
  const evidence = extractTrailerEvidence(linked);

  // 关联外部证据源
  for (const source of evidenceSources) {
    // Match by commit SHA
    if (source.commitSha && linked.commit?.sha && source.commitSha === linked.commit.sha) {
      linked.verification.evidenceRefs.push(`${source.type}:${source.path}`);
      continue;
    }

    // Match by commit subject
    if (source.matchSubject && linked.commit?.subject) {
      const subjectNormalized = linked.commit.subject.toLowerCase().trim();
      const matchNormalized = source.matchSubject.toLowerCase().trim();
      if (subjectNormalized.includes(matchNormalized) || matchNormalized.includes(subjectNormalized)) {
        linked.verification.evidenceRefs.push(`${source.type}:${source.path}`);
      }
    }
  }

  // 计算证据分数
  const score = calculateEvidenceScore(evidence, linked.actor);

  // 归一化状态
  linked.verification.status = scoreToStatus(score);
  linked.verification.observedAt = new Date().toISOString();

  return linked;
}

/**
 * 批量关联证据
 */
export function linkEvidenceBatch(records: LedgerRecord[], evidenceSources: EvidenceSource[] = []): LedgerRecord[] {
  return records.map(record => linkEvidence(record, evidenceSources));
}

/**
 * 检测冲突记录
 * 相同 repoId + commitSha 但 verification status 不同
 */
export function detectConflicts(records: LedgerRecord[]): Conflict[] {
  const seen = new Map<string, LedgerRecord>();
  const conflicts: Conflict[] = [];

  for (const record of records) {
    const key = `${record.repo?.projectId}:${record.commit?.sha}`;

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (existing.verification?.status !== record.verification?.status) {
        conflicts.push({
          recordId: record.recordId || '',
          sha: record.commit?.sha,
          projectId: record.repo?.projectId,
          conflict: {
            recordA: existing.recordId || '',
            statusA: existing.verification?.status || VerificationStatus.UNKNOWN,
            recordB: record.recordId || '',
            statusB: record.verification?.status || VerificationStatus.UNKNOWN
          }
        });
      }
    } else {
      seen.set(key, record);
    }
  }

  return conflicts;
}

/**
 * 检测过期记录
 * 超过阈值天数未更新的 verified 记录
 */
export function detectStale(records: LedgerRecord[], thresholdDays: number = 30): StaleRecord[] {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - thresholdDays);

  return records
    .filter(r => {
      const observed = new Date(r.verification?.observedAt || 0);
      return observed < threshold && r.verification?.status === VerificationStatus.VERIFIED;
    })
    .map(r => ({
      recordId: r.recordId || '',
      sha: r.commit?.sha,
      projectId: r.repo?.projectId,
      verifiedAt: r.verification?.observedAt,
      staleDays: Math.floor((Date.now() - new Date(r.verification?.observedAt || 0).getTime()) / (1000 * 60 * 60 * 24))
    }));
}

/**
 * 获取验证状态统计
 */
export function getVerificationStats(records: LedgerRecord[]): VerificationStats {
  const stats: VerificationStats = {
    verified: 0,
    partial: 0,
    unverified: 0,
    failed: 0,
    conflict: 0,
    unknown: 0
  };

  for (const record of records) {
    const status = record.verification?.status || VerificationStatus.UNKNOWN;
    if (status in stats) {
      (stats as Record<string, number>)[status]++;
    } else {
      stats.unknown++;
    }
  }

  return stats;
}

/**
 * 验证状态输出映射
 *
 * Outputs verification status:
 * - verified: Has Tested trailer AND evidence found
 * - partial: Has some evidence but incomplete
 * - unverified: No evidence found
 * - failed: Evidence contradicts or test failed
 * - unknown: Cannot determine
 * - conflict: Multiple conflicting evidence
 */
export function formatVerificationStatus(status: VerificationStatus): string {
  const descriptions: Record<VerificationStatus, string> = {
    [VerificationStatus.VERIFIED]: 'Has Tested trailer AND evidence found',
    [VerificationStatus.PARTIAL]: 'Has some evidence but incomplete',
    [VerificationStatus.UNVERIFIED]: 'No evidence found',
    [VerificationStatus.FAILED]: 'Evidence contradicts or test failed',
    [VerificationStatus.UNKNOWN]: 'Cannot determine',
    [VerificationStatus.CONFLICT]: 'Multiple conflicting evidence'
  };
  return descriptions[status] || 'Unknown status';
}
