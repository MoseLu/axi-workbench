#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventoryPath = path.join(repoRoot, 'docs/specs/2026-08-09-multi-surface-admin-positioning/CAPABILITY-INVENTORY.json');
const requiredFields = [
  'id', 'surface', 'route', 'allowedActions', 'role', 'dataSource', 'dataStatus', 'actionLevel', 'owner',
  'serverAuthorization', 'revalidation', 'idempotency', 'audit', 'handoff', 'unsupported', 'status',
];
const actionLevels = new Set(['A', 'B', 'C', 'D']);
const statuses = new Set(['implemented', 'retired', 'planned']);

export function validateCapabilityInventory(file = inventoryPath) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  const records = Array.isArray(parsed.records) ? parsed.records : [];
  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.reviewedAt || ''))) errors.push('top-level reviewedAt must be an ISO date');
  if (!Array.isArray(parsed.reviewedBy) || !parsed.reviewedBy.length) errors.push('top-level reviewedBy must name review roles');
  if (!records.length) errors.push('records must not be empty');
  const ids = new Set();
  for (const record of records) {
    for (const key of requiredFields) {
      const value = record?.[key];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
        errors.push(`${record?.id || '<unknown>'}: missing ${key}`);
      }
    }
    if (ids.has(record?.id)) errors.push(`${record?.id}: duplicate id`);
    ids.add(record?.id);
    if (!actionLevels.has(record?.actionLevel)) errors.push(`${record?.id}: actionLevel must be A/B/C/D`);
    if (!statuses.has(record?.status)) errors.push(`${record?.id}: unsupported status`);
    if (record?.dataStatus === 'prototype' && ['B', 'C', 'D'].includes(record?.actionLevel)) {
      errors.push(`${record?.id}: prototype records cannot claim executable B/C/D actions`);
    }
    if (record?.dataStatus === 'prototype' && record?.status !== 'retired') {
      errors.push(`${record?.id}: prototype records must be retired before delivery`);
    }
  }
  if (!records.some((record) => record.id === 'mobile-workspace-projection' && record.dataStatus === 'live_or_unavailable')) {
    errors.push('mobile-workspace-projection must document the real-or-unavailable projection');
  }
  if (!records.some((record) => record.id === 'mobile-approval-scan')) errors.push('mobile approval scan record is required');
  if (!records.some((record) => record.id === 'mobile-web-login-confirmation')) errors.push('OIDC confirmation record is required');
  if (errors.length) throw new Error(`Capability inventory failed:\n- ${errors.join('\n- ')}`);
  return { records: records.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateCapabilityInventory();
  console.log(`Capability inventory: PASS (${result.records} records)`);
}
