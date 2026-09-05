import type { TenantMembership, TenantRole } from '@epap/api-client';

/**
 * AxiCrud expects record-shaped rows.  Keep this adapter local to the desktop
 * membership screen instead of changing the API contract just for a UI table.
 */
export type TenantMemberRow = Record<string, unknown> & TenantMembership;

export type TenantMemberFilter = {
  /** 角色精确过滤；空表示全部。 */
  role?: TenantRole | '';
  /** 成员标识 / 角色关键字。 */
  keyword?: string;
};

export const tenantRoleLabels: Record<TenantRole, string> = {
  owner: '所有者',
  admin: '管理员',
  editor: '编辑者',
  viewer: '查看者',
};

/** Cool Admin 风格角色字典：带颜色 Tag。 */
export const tenantRoleOptions = (Object.entries(tenantRoleLabels) as Array<[TenantRole, string]>).map(
  ([value, label]) => ({
    color: roleTagColor(value),
    label,
    value,
  }),
);

function roleTagColor(role: TenantRole): string {
  switch (role) {
    case 'owner':
      return 'red';
    case 'admin':
      return 'blue';
    case 'editor':
      return 'green';
    case 'viewer':
    default:
      return 'default';
  }
}

export function toTenantMemberRow(member: TenantMembership): TenantMemberRow {
  return { ...member };
}

/** 仅对服务端返回的成员做视图筛选；不会创建或保留浏览器端业务记录。 */
export function filterTenantMembers(
  rows: TenantMemberRow[],
  keywordOrFilter: string | TenantMemberFilter = '',
): TenantMemberRow[] {
  const filter: TenantMemberFilter = typeof keywordOrFilter === 'string'
    ? { keyword: keywordOrFilter }
    : keywordOrFilter;

  const role = filter.role || '';
  const normalized = (filter.keyword ?? '').trim().toLocaleLowerCase();

  return rows.filter((row) => {
    if (role && row.role !== role) return false;
    if (!normalized) return true;
    return [row.subject, row.role, tenantRoleLabels[row.role]].some((value) => (
      value.toLocaleLowerCase().includes(normalized)
    ));
  });
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

/** Cool Admin 默认分页：共 N 条 + 页大小切换。 */
export const DESKTOP_CRUD_PAGE_SIZE = 20;

export function desktopCrudPagination(total: number): {
  defaultPageSize: number;
  hideOnSinglePage: boolean;
  pageSizeOptions: string[];
  showQuickJumper: boolean;
  showSizeChanger: boolean;
  showTotal: (count: number) => string;
  total: number;
} {
  return {
    defaultPageSize: DESKTOP_CRUD_PAGE_SIZE,
    hideOnSinglePage: false,
    pageSizeOptions: ['10', '20', '50', '100'],
    showQuickJumper: true,
    showSizeChanger: true,
    showTotal: (count: number) => `共 ${count} 条`,
    total,
  };
}
