<template>
  <div class="logs-root">
  <BtcCrud
    ref="requestCrudRef"
    class="request-log-page"
    :service="requestService"
    :auto-load="true"
    :on-before-refresh="onBeforeRefresh"
  >
      <BtcCrudRow>
        <div class="btc-crud-primary-actions">
          <BtcRefreshBtn />

          <el-button
            type="danger"
            @click="clearLogs"
          >
            {{ t('common.ops.logs.request.clear') }}
          </el-button>
        </div>

        <div class="log-keep-filter">
          <span>{{ t('common.ops.logs.request.log_retention_days') }}：</span>
          <el-input-number
            v-model="keepDays"
            :min="1"
            :max="10000"
            controls-position="right"
            @change="saveKeepDays"
          />
        </div>

        <BtcCrudFlex1 />
        <BtcCrudSearchKey :placeholder="t('common.ops.logs.request.search_placeholder')" />
        <BtcCrudActions />
      </BtcCrudRow>

      <BtcCrudRow>
      <BtcTable
        ref="tableRef"
        :columns="requestColumns"
        :context-menu="['refresh']"
        :auto-height="true"
        border
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
import { BtcConfirm, BtcMessage } from '@btc/shared-components';
import {
  BtcCrud,
  BtcTable,
  BtcPagination,
  BtcRefreshBtn,
  BtcCrudRow,
  BtcCrudFlex1,
  BtcCrudSearchKey,
  BtcCrudActions,
} from '@btc/shared-components';
import { usePageColumns, getPageConfigFull, useI18n, logger } from '@btc/shared-core';
import { service } from '@services/eps';

defineOptions({
  name: 'RequestLog'
});

const { t } = useI18n();

// 请求日志服务（打印可用方法）
// 确保 service 存在，避免 undefined 错误
const rawRequestService = (service && service.admin?.log?.request) as any;
// 包装：兜底提供 list 方法以避免卡在 loading（待确认真实分页方法名后再收敛）
function normalizePageResult(res: any) {
  if (!res) return { list: [], total: 0 };
  // 常见分页返回兼容
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

const requestService = {
  ...(rawRequestService || {}),
  async page(params: any) {
    const s = rawRequestService || {};
    try {
      let res: any;
      if (typeof s.page === 'function') res = await s.page(params);
      else if (typeof s.list === 'function') res = await s.list(params);
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
  },
  async list(params: any) {
    const s = rawRequestService || {};
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
    // 兜底：返回空数据，避免 loading 挂起
    // 如果 try 块成功执行，这里不会被执行（已在 try 中 return）
    // 但保留作为类型检查的兜底逻辑
    // eslint-disable-next-line no-unreachable
    const pageNo = params?.page ?? 1;
    return { list: [], total: 0, page: pageNo, size: 0, success: true, rows: [], records: [], data: { list: [], total: 0, page: pageNo, size: 0 } };
  },
};
function onBeforeRefresh(params: Record<string, unknown>) {
  return params || {};
}

// 请求日志列配置 - 从 config.ts 读取并扩展以支持特殊组件和 formatter
const requestColumns = computed(() => {
  return baseRequestColumns.value.map(col => {
    // 如果列是 params，添加 BtcCodeJson 组件
    if (col.prop === 'params') {
      return {
        ...col,
        component: {
          name: 'BtcCodeJson',
          props: {
            popover: true,
            maxLength: 500,
            popoverTrigger: 'hover',
            teleported: true,
            popperStrategy: 'fixed'
          }
        }
      };
    }
    // 如果列是 ip，添加自定义 formatter
    if (col.prop === 'ip') {
      return {
        ...col,
        formatter(row: any) {
          try {
            if (row.ip === null || row.ip === undefined || typeof row.ip !== 'string') {
              return '-';
            }
            if (row.ip === '') {
              return '';
            }
            const ipStr = row.ip.length > 1000 ? row.ip.substring(0, 1000) + '...' : row.ip;
            return ipStr.split(',').map((ip: string) => ip.trim()).filter((ip: any) => ip).join(', ');
          } catch (error) {
            logger.error('IP field format error:', error);
            return '-';
          }
        }
      };
    }
    // 如果列是 duration，添加自定义 formatter
    if (col.prop === 'duration') {
      return {
        ...col,
        formatter(row: any) {
          return row.duration ? `${row.duration}ms` : '-';
        }
      };
    }
    // 如果列是 status，添加 dict 配置
    if (col.prop === 'status') {
      return {
        ...col,
        dict: [
          { label: t('common.success'), value: 'success', type: 'success' },
          { label: t('common.failed'), value: 'failed', type: 'danger' }
        ],
        dictColor: true
      };
    }
    return col;
  });
});

// CRUD 引用
const requestCrudRef = ref();
const tableRef = ref();
const route = useRoute();

// 日志保存天数
const keepDays = ref(31);

// 获取保存天数
onMounted(async () => {
  try {
    // 暂时注释掉，等待后端提供接口
    // const res = await requestService.getKeep();
    // keepDays.value = Number(res);
  } catch (err) {
    logger.error('Failed to get log retention days', err);
  }
  await nextTick();
  try {
    const rows = requestCrudRef.value?.tableData?.value?.length ?? requestCrudRef.value?.crud?.tableData?.value?.length;
  } catch (e) {
    /* ignore */
  }
  // 强制触发一次刷新，防止切换返回时留在 loading 状态
  requestCrudRef.value?.refresh?.();
  // 强制一次布局计算
  await nextTick();
  try {
    tableRef.value?.calcMaxHeight?.();
    tableRef.value?.tableRef?.value?.doLayout?.();
  } catch {
    // 忽略错误，静默处理
  }
  // 触发全局 resize，驱动内部高度计算
  try {
    window.dispatchEvent(new Event('resize'));
  } catch {
    // 忽略错误，静默处理
  }
});

// 页面再次激活（从另一个日志页切回）时，强制计算高度与布局
onActivated(async () => {
  await nextTick();
  try {
    tableRef.value?.calcMaxHeight?.();
    tableRef.value?.tableRef?.value?.doLayout?.();
  } catch {
    // 忽略错误，静默处理
  }
  // 触发全局 resize，驱动内部高度计算
  try {
    window.dispatchEvent(new Event('resize'));
  } catch {
    // 忽略错误，静默处理
  }
});
// 保存天数
async function saveKeepDays() {
  try {
    // 暂时注释掉，等待后端提供接口
    // await requestService.setKeep({ value: keepDays.value });
    BtcMessage.success(t('common.save_success'));
  } catch (err: any) {
    BtcMessage.error(err.message || t('common.save_failed'));
  }
}

// 清空日志
function clearLogs() {
  BtcConfirm(t('common.ops.logs.request.clear_confirm'), t('common.tip'), {
    type: 'warning'
  })
    .then(async () => {
      try {
        // 暂时注释掉，等待后端提供接口
        // await requestService.clear();
        BtcMessage.success(t('common.ops.logs.request.clear_success'));
        requestCrudRef.value?.refresh?.();
      } catch (err: any) {
        BtcMessage.error(err.message || t('common.ops.logs.request.clear_failed'));
      }
    })
    .catch(() => null);
}

</script>

<style lang="scss" scoped>
.logs-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>

<style lang="scss" scoped>
.log-keep-filter {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;

  span {
    white-space: nowrap;
  }
}

// 局部禁用下拉过渡，减少 ResizeObserver 回调链
:deep(.el-dropdown__list) {
  transition: none !important;
  animation: none !important;
}
</style>
