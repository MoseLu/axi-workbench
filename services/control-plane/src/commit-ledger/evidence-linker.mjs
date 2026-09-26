/**
 * Commit Ledger Evidence Linker
 * 建立 commit 与证据的关联，归一化验证状态
 */

export const VerificationStatus = {
  VERIFIED: 'verified',
  PARTIAL: 'partial',
  UNVERIFIED: 'unverified',
  FAILED: 'failed',
  CONFLICT: 'conflict',
  UNKNOWN: 'unknown'
};

/**
 * 从 commit trailers 提取证据
 */
export function extractTrailerEvidence(record) {
  const evidence = {
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
    evidence.confidence = record.trailers.confidence;
    evidence.scopeRisk = record.trailers.scopeRisk;
    evidence.directive = record.trailers.directive;
    evidence.refs = record.trailers.refs || [];
  }

  return evidence;
}

/**
 * 计算证据分数
 * 分数范围: -2 到 6
 */
export function calculateEvidenceScore(evidence, actor = {}) {
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
    score += evidence.confidence >= 0.8 ? 2 : 1;
  }

  // 4. Scope risk (-1 for high/critical)
  if (evidence.scopeRisk && ['high', 'critical'].includes(evidence.scopeRisk.toLowerCase())) {
    score -= 1;
  }

  // 5. CI 自动提交 (+1)
  const name = actor.name || '';
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
export function scoreToStatus(score) {
  if (score >= 4) return VerificationStatus.VERIFIED;
  if (score >= 2) return VerificationStatus.PARTIAL;
  if (score <= -1) return VerificationStatus.FAILED;
  return VerificationStatus.UNVERIFIED;
}

/**
 * 关联证据到提交记录
 */
export function linkEvidence(record, evidenceSources = []) {
  const linked = { ...record };

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
    if (source.commitSha === linked.commit?.sha) {
      linked.verification.evidenceRefs.push(`${source.type}:${source.path}`);
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
export function linkEvidenceBatch(records, evidenceSources = []) {
  return records.map(record => linkEvidence(record, evidenceSources));
}

/**
 * 检测冲突记录
 * 相同 repoId + commitSha 但 verification status 不同
 */
export function detectConflicts(records) {
  const seen = new Map();
  const conflicts = [];

  for (const record of records) {
    const key = `${record.repo?.projectId}:${record.commit?.sha}`;

    if (seen.has(key)) {
      const existing = seen.get(key);
      if (existing.verification?.status !== record.verification?.status) {
        conflicts.push({
          recordId: record.recordId,
          sha: record.commit?.sha,
          projectId: record.repo?.projectId,
          conflict: {
            recordA: existing.recordId,
            statusA: existing.verification?.status,
            recordB: record.recordId,
            statusB: record.verification?.status
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
export function detectStale(records, thresholdDays = 30) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - thresholdDays);

  return records
    .filter(r => {
      const observed = new Date(r.verification?.observedAt || 0);
      return observed < threshold && r.verification?.status === VerificationStatus.VERIFIED;
    })
    .map(r => ({
      recordId: r.recordId,
      sha: r.commit?.sha,
      projectId: r.repo?.projectId,
      verifiedAt: r.verification?.observedAt,
      staleDays: Math.floor((Date.now() - new Date(r.verification?.observedAt || 0)) / (1000 * 60 * 60 * 24))
    }));
}

/**
 * 获取验证状态统计
 */
export function getVerificationStats(records) {
  const stats = {
    verified: 0,
    partial: 0,
    unverified: 0,
    failed: 0,
    conflict: 0,
    unknown: 0
  };

  for (const record of records) {
    const status = record.verification?.status || VerificationStatus.UNKNOWN;
    if (stats.hasOwnProperty(status)) {
      stats[status]++;
    } else {
      stats.unknown++;
    }
  }

  return stats;
}
