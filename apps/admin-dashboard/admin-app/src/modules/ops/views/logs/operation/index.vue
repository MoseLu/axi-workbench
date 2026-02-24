<template>
  <!-- 操作日志：增加稳定容器，确保切换时不丢失高度计算上下文 -->
  <div class="logs-root">
  <BtcCrud ref="auditCrudRef" :service="auditService" :on-before-refresh="onBeforeRefresh" :auto-load="true" style="flex: 1; min-height: 0;">
    <BtcCrudRow>
      <BtcRefreshBtn />
      <BtcCrudFlex1 />
      <BtcCrudSearchKey placeholder="搜索操作日志..." />
      <BtcCrudActions />
    </BtcCrudRow>
    <BtcCrudRow>
      <BtcTable
        ref="auditTableRef"
        :columns="auditColumns"
        border
        :auto-height="false"
        :max-height="tableMaxHeight"
      />
    </BtcCrudRow>
    <BtcCrudRow>
      <BtcCrudFlex1 />
      <BtcPagination />
    </BtcCrudRow>
  </BtcCrud>
  </div>
</template>

<script setup lang="ts">
import { BtcCrud, BtcTable, BtcPagination, BtcRefreshBtn, BtcCrudRow, BtcCrudFlex1, BtcCrudSearchKey, BtcCrudActions } from '@btc/shared-components';
import { usePageColumns, getPageConfigFull } from '@btc/shared-core';
import { service } from '@services/eps';

defineOptions({
  name: 'OpsAudit'
});

// 路由
const route = useRoute();

// 审计日志服务（操作日志）
const rawAuditService = service.admin?.log?.operation as any;
function normalizePageResult(res: any) {
  if (!res) return { list: [], total: 0 };
  const list =
    res.list ??
    res.records ??
    res.rows ??
    res.data ??
    (Array.isArray(res) ? res : []) ??
    [];
  const total =
    res.total ??
    res.count ??
    (typeof res.pagination === 'object' ? res.pagination.total : undefined) ??
    0;
  return { list, total: Number.isFinite(total) ? total : (Array.isArray(list) ? list.length : 0) };
}

const auditService = {
  ...(rawAuditService || {}),
  async page(params: any) {
    const s = rawAuditService || {};
    try {
      let res: any;
      if (typeof s.page === 'function') res = await s.page(params);
      else if (typeof s.list === 'function') res = await s.list(params);
      else if (typeof s.query === 'function') res = await s.query(params);
      else if (typeof s.search === 'function') res = await s.search(params);
      const { list, total } = normalizePageResult(res);
      const pageNo = params?.page ?? 1;
      const pageSize = params?.size ?? list.length;
      // 兼容多种 CRUD 解析器
      const result = {
        list,
        total,
        page: pageNo,
        size: pageSize,
        success: true,
        rows: list,
        records: list,
        count: total,
        data: { list, total, page: pageNo, size: pageSize },
      };
      return result;
    } catch (err) {
      const pageNo = params?.page ?? 1;
      const pageSize = params?.size ?? 0;
      return { list: [], total: 0, page: pageNo, size: pageSize, success: false, rows: [], records: [], data: { list: [], total: 0, page: pageNo, size: pageSize } };
    }
  },
  async list(params: any) {
    const s = rawAuditService || {};
    try {
      let res: any;
      if (typeof s.list === 'function') res = await s.list(params);
      else if (typeof s.page === 'function') res = await s.page(params);
      else if (typeof s.query === 'function') res = await s.query(params);
      else if (typeof s.search === 'function') res = await s.search(params);
      const { list, total } = normalizePageResult(res);
      const pageNo = params?.page ?? 1;
      const pageSize = params?.size ?? list.length;
      const result = {
        list,
        total,
        page: pageNo,
        size: pageSize,
        success: true,
        rows: list,
        records: list,
        count: total,
        data: { list, total, page: pageNo, size: pageSize },
      };
      return result;
    } catch (err) {
      const pageNo = params?.page ?? 1;
      const pageSize = params?.size ?? 0;
      return { list: [], total: 0, page: pageNo, size: pageSize, success: false, rows: [], records: [], data: { list: [], total: 0, page: pageNo, size: pageSize } };
    }
    // 如果 try 块成功执行，这里不会被执行（已在 try 中 return）
    // 但保留作为类型检查的兜底逻辑
    // eslint-disable-next-line no-unreachable
    return { list: [], total: 0, page: params?.page ?? 1, size: 0, success: true };
  },
};
function onBeforeRefresh(params: Record<string, unknown>) {
  return params || {};
}

// 从 config.ts 读取配置
const { columns: baseAuditColumns } = usePageColumns('ops.logs.operation');
const pageConfig = getPageConfigFull('ops.logs.operation');

// 审计日志列配置 - 扩展以支持 BtcCodeJson 组件
const auditColumns = computed(() => {
  return baseAuditColumns.value.map(col => {
    // 如果列是 beforeData，添加 BtcCodeJson 组件
    if (col.prop === 'beforeData') {
      return {
        ...col,
        component: { name: 'BtcCodeJson', props: { popover: true, maxLength: 500, popoverTrigger: 'hover', teleported: true, popperStrategy: 'fixed' } }
      };
    }
    return col;
  });
});

// CRUD / 表格引用
const auditCrudRef = ref();
const auditTableRef = ref();
const tableMaxHeight = ref(400);

function computeTableMaxHeight(tag = 'compute') {
  try {
    const root = (auditCrudRef.value?.$el as HTMLElement) || null;
    if (!root) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const rows = Array.from(root.querySelectorAll('.btc-crud-row')) as HTMLElement[];
    const headerRow = rows[0];
    const footerRow = rows.length > 1 ? rows[rows.length - 1] : undefined;
    const headerH = headerRow ? headerRow.getBoundingClientRect().height : 0;
    const footerH = footerRow ? footerRow.getBoundingClientRect().height : 0;
    const paddingTop = parseFloat(getComputedStyle(root).paddingTop || '0');
    const paddingBottom = parseFloat(getComputedStyle(root).paddingBottom || '0');
    const available = Math.max(0, rect.height - headerH - footerH - paddingTop - paddingBottom);
    tableMaxHeight.value = Math.max(120, Math.floor(available));
    // heights computed
  } catch (e) {
    /* ignore */
  }
}
function logTableSize(tag: string) {
  try {
    const crudEl = (auditCrudRef.value?.$el as HTMLElement) || null;
    const tableVm = (auditTableRef.value?.tableRef?.value as any) || null;
    const tableEl: HTMLElement | null = tableVm?.$el ?? null;
    const maxH = auditTableRef.value?.maxHeight?.value ?? null;
    const crudRect = crudEl ? crudEl.getBoundingClientRect() : null;
    const tableRect = tableEl ? tableEl.getBoundingClientRect() : null;
    // sizes logged for debug removed
  } catch (e) {
    /* ignore */
  }
}

onMounted(async () => {
  await nextTick();
  computeTableMaxHeight('after-mount-compute');
  try {
    const rows = auditCrudRef.value?.tableData?.value?.length ?? auditCrudRef.value?.crud?.tableData?.value?.length;
  } catch (e) {
    /* ignore */
  }
  // 强制触发一次刷新，防止切换返回时留在 loading 状态
  auditCrudRef.value?.refresh?.();
  // 强制一次布局计算
  await nextTick();
  computeTableMaxHeight('after-activate-compute');
  try {
    auditTableRef.value?.calcMaxHeight?.();
    auditTableRef.value?.tableRef?.value?.doLayout?.();
  } catch {
    // 忽略错误，静默处理
  }
  // 触发全局 resize，驱动内部高度计算
  try {
    window.dispatchEvent(new Event('resize'));
  } catch {
    // 忽略错误，静默处理
  }
  await nextTick();
  logTableSize('after-mount');
});

// 页面再次激活（从另一个日志页切回）时，强制计算高度与布局
onActivated(async () => {
  await nextTick();
  try {
    auditTableRef.value?.calcMaxHeight?.();
    auditTableRef.value?.tableRef?.value?.doLayout?.();
  } catch {
    // 忽略错误，静默处理
  }
  try {
    window.dispatchEvent(new Event('resize'));
  } catch {
    // 忽略错误，静默处理
  }
  await nextTick();
  logTableSize('after-activate');
});

</script>

<style lang="scss" scoped>
.logs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
