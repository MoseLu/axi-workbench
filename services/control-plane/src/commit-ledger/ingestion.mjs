/**
 * Commit Ledger Ingestion Service
 * 入库接口和幂等操作
 */

import { createHash } from 'crypto';

/**
 * 生成幂等键
 */
export function generateIdempotencyKey(repoId, commitSha) {
  return `${repoId}:${commitSha}`;
}

/**
 * 生成 recordId
 */
export function generateRecordId(repoId, commitSha) {
  return createHash('sha256').update(`${repoId}:${commitSha}`).digest('hex');
}

/**
 * 入库状态
 */
export const IngestionStatus = {
  NEW: 'new',
  UPDATED: 'updated',
  UNCHANGED: 'unchanged',
  CONFLICT: 'conflict'
};

/**
 * 冲突检测
 */
export function detectConflict(existing, incoming) {
  if (!existing) return false;

  // 1. SHA 不同
  if (existing.commit?.sha !== incoming.commit?.sha) {
    return true;
  }

  // 2. verification status 冲突
  const existingStatus = existing.verification?.status;
  const incomingStatus = incoming.verification?.status;
  if (existingStatus && incomingStatus) {
    // verified 和 failed 互斥
    if (existingStatus === 'verified' && incomingStatus === 'failed') return true;
    if (existingStatus === 'failed' && incomingStatus === 'verified') return true;
  }

  // 3. provenance source 冲突
  if (existing.provenance?.source !== incoming.provenance?.source) {
    return true;
  }

  return false;
}

/**
 * 冲突解决策略
 */
export const ConflictResolution = {
  NEWER_WINS: 'newer_wins',
  SOURCE_PRIORITY: 'source_priority',
  MANUAL: 'manual'
};

/**
 * 解决冲突
 */
export function resolveConflict(existing, incoming, strategy = ConflictResolution.NEWER_WINS) {
  if (strategy === ConflictResolution.NEWER_WINS) {
    const existingTime = new Date(existing.ingestion?.lastSeenAt || 0);
    const incomingTime = new Date(incoming.provenance?.observedAt || 0);
    return incomingTime > existingTime ? incoming : existing;
  }

  if (strategy === ConflictResolution.SOURCE_PRIORITY) {
    const priority = ['git', 'submit-log', 'changelog', 'test-report', 'workspace-snapshot'];
    const existingPriority = priority.indexOf(existing.provenance?.source);
    const incomingPriority = priority.indexOf(incoming.provenance?.source);
    return incomingPriority < existingPriority ? incoming : existing;
  }

  // MANUAL: 标记为冲突
  const resolved = incoming;
  resolved.verification = resolved.verification || {};
  resolved.verification.status = 'conflict';
  return resolved;
}

/**
 * 幂等 Upsert
 */
export function upsert(existing, incoming) {
  // 无现有记录 -> 新建
  if (!existing) {
    return {
      record: incoming,
      status: IngestionStatus.NEW
    };
  }

  // 检测冲突
  if (detectConflict(existing, incoming)) {
    return {
      record: resolveConflict(existing, incoming),
      status: IngestionStatus.CONFLICT
    };
  }

  // 内容相同 -> 无变化
  if (JSON.stringify(existing) === JSON.stringify(incoming)) {
    return {
      record: existing,
      status: IngestionStatus.UNCHANGED
    };
  }

  // 更新
  const updated = {
    ...incoming,
    ingestion: {
      ...incoming.ingestion,
      firstSeenAt: existing.ingestion?.firstSeenAt || incoming.ingestion?.firstSeenAt,
      lastSeenAt: new Date().toISOString()
    }
  };

  return {
    record: updated,
    status: IngestionStatus.UPDATED
  };
}

/**
 * 批量 Upsert
 */
export function upsertBatch(existingRecords = [], incomingRecords = []) {
  const existingMap = new Map();
  for (const record of existingRecords) {
    const key = record.ingestion?.idempotencyKey || `${record.repo?.projectId}:${record.commit?.sha}`;
    existingMap.set(key, record);
  }

  const results = {
    new: [],
    updated: [],
    unchanged: [],
    conflict: [],
    errors: []
  };

  for (const incoming of incomingRecords) {
    const key = incoming.ingestion?.idempotencyKey || `${incoming.repo?.projectId}:${incoming.commit?.sha}`;
    const existing = existingMap.get(key);

    try {
      const result = upsert(existing, incoming);
      results[result.status].push(result.record);
    } catch (e) {
      results.errors.push({ key, error: e.message });
    }
  }

  return results;
}

/**
 * 过期检测
 */
export function isStale(record, thresholdDays = 30) {
  const observed = new Date(record.verification?.observedAt || record.ingestion?.lastSeenAt || 0);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - thresholdDays);
  return observed < threshold;
}

/**
 * 过滤过期记录
 */
export function filterStale(records, thresholdDays = 30) {
  return records.filter(r => !isStale(r, thresholdDays));
}
