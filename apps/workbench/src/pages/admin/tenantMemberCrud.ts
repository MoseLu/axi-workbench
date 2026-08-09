import type { TenantMembership, TenantRole } from '@epap/api-client';

/**
 * AxiCrud expects record-shaped rows.  Keep this adapter local to the desktop
 * membership screen instead of changing the API contract just for a UI table.
 */
export type TenantMemberRow = Record<string, unknown> & TenantMembership;

export const tenantRoleLabels: Record<TenantRole, string> = {
  owner: '所有者',
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者',
};

export const tenantRoleOptions = (Object.entries(tenantRoleLabels) as Array<[TenantRole, string]>).map(([value, label]) => ({
  label,
  value,
}));

export function toTenantMemberRow(member: TenantMembership): TenantMemberRow {
  return { ...member };
}

/** 仅对服务端返回的成员做视图筛选；不会创建或保留浏览器端业务记录。 */
export function filterTenantMembers(rows: TenantMemberRow[], keyword: string): TenantMemberRow[] {
  const normalized = keyword.trim().toLocaleLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => [row.subject, row.role, tenantRoleLabels[row.role]].some((value) => (
    value.toLocaleLowerCase().includes(normalized)
  )));
}

export function formatTenantMemberTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    year: 'numeric',
  }).format(date);
}
