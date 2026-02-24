<template>
  <div class="page">
    <BtcTabs v-model="activeTab" :tabs="logTabs" @tab-change="handleTabChange">
      <!-- 操作日志 Tab -->
      <template #operation>
        <BtcCrud
          v-if="logServices.operationLog"
          ref="operationCrudRef"
          :service="logServices.operationLog"
          style="padding: 10px;"
        >
          <BtcCrudRow>
            <BtcRefreshBtn />
            <BtcCrudFlex1 />
            <BtcCrudSearchKey placeholder="搜索操作日志..." />
          </BtcCrudRow>
          <BtcCrudRow>
            <BtcTable
              :columns="operationLogColumns"
              border
              storage-key="ops-logs-operation"
              :auto-height="true"
              @button-click="handleButtonClick"
            />
          </BtcCrudRow>
          <BtcCrudRow>
            <BtcCrudFlex1 />
            <BtcPagination />
          </BtcCrudRow>
        </BtcCrud>
        <div v-else class="service-unavailable">
          <BtcEmpty :description="t('common.ops.logs.operation.service_unavailable')" />
        </div>
      </template>

      <!-- 请求日志 Tab -->
      <template #request>
        <BtcCrud
          v-if="logServices.requestLog"
          ref="requestCrudRef"
          :service="logServices.requestLog"
          style="padding: 10px;"
        >
          <BtcCrudRow>
            <BtcRefreshBtn />
            <BtcCrudFlex1 />
            <BtcCrudSearchKey :placeholder="t('common.ops.logs.request.search_placeholder')" />
          </BtcCrudRow>
          <BtcCrudRow>
            <BtcTable
              :columns="requestLogColumns"
              border
              storage-key="ops-logs-request"
              :auto-height="true"
              @button-click="handleButtonClick"
            />
          </BtcCrudRow>
          <BtcCrudRow>
            <BtcCrudFlex1 />
            <BtcPagination />
          </BtcCrudRow>
        </BtcCrud>
        <div v-else class="service-unavailable">
          <BtcEmpty :description="t('common.ops.logs.request.service_unavailable')" />
        </div>
      </template>
    </BtcTabs>

    <!-- 日志详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      :title="detailTitle"
      width="900px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-descriptions :column="2" border>
        <el-descriptions-item
          v-for="item in detailFields"
          :key="item.prop"
          :label="item.label"
        >
          <template v-if="item.prop === 'requestData' || item.prop === 'responseData' || item.prop === 'beforeData'">
            <pre class="json-view">{{ formatJson(currentLog[item.prop]) }}</pre>
          </template>
          <template v-else-if="item.prop === 'createdAt'">
            {{ currentLog[item.prop] ? new Date(currentLog[item.prop]).toLocaleString('zh-CN') : '-' }}
          </template>
          <template v-else>
            {{ currentLog[item.prop] || '-' }}
          </template>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 操作前数据详情 -->
      <template v-if="currentLog.beforeData">
        <el-divider>操作前数据</el-divider>
        <pre class="json-view">{{ formatJson(currentLog.beforeData) }}</pre>
      </template>

      <!-- 请求/响应数据详情 -->
      <template v-if="currentLog.requestData || currentLog.responseData">
        <el-divider>请求数据</el-divider>
        <pre class="json-view">{{ formatJson(currentLog.requestData) }}</pre>

        <el-divider>响应数据</el-divider>
        <pre class="json-view">{{ formatJson(currentLog.responseData) }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import {
  BtcTabs,
  BtcCrud,
  BtcCrudRow,
  BtcRefreshBtn,
  BtcCrudFlex1,
  BtcCrudSearchKey,
  BtcTable,
  BtcPagination
} from '@btc/shared-components';
import { useI18n, usePageColumns, getPageConfigFull } from '@btc/shared-core';
import { BtcEmpty } from '@btc/shared-components';

defineOptions({
  name: 'OpsLogs'
});

// 从模块级配置读取
const { columns: operationLogColumns } = usePageColumns('ops.logs.operation');
const { columns: requestLogColumns } = usePageColumns('ops.logs.request');
const opsPageConfig = getPageConfigFull('ops.logs.operation'); // 使用同一个配置，因为 service 在同一个 config 中

// 服务配置
const logServices = {
  operationLog: opsPageConfig?.service?.operation,
  requestLog: opsPageConfig?.service?.request,
};

// Tab 配置
const logTabs = [
  {
    name: 'operation',
    label: t('menu.ops.operation_log')
  },
  {
    name: 'request',
    label: t('menu.ops.request_log')
  }
];

// 当前激活的tab
const activeTab = ref('operation');

// 当前页表格存储键（用于排查偏好影响）
const currentStorageKey = computed(() => (activeTab.value === 'operation' ? 'ops-logs-operation' : 'ops-logs-request'));

// CRUD 引用
const operationCrudRef = ref();
const requestCrudRef = ref();

// 详情对话框
const detailVisible = ref(false);
const currentLog = ref<any>({});

// 详情标题
const detailTitle = computed(() => {
  return activeTab.value === 'operation' ? t('common.ops.logs.operation.detail') : t('common.ops.logs.request.detail');
});

// 详情字段配置
const detailFields = computed(() => {
  if (activeTab.value === 'operation') {
    return [
      { prop: 'createdAt', label: t('common.ops.logs.operation.fields.create_time') },
      { prop: 'username', label: t('common.ops.logs.operation.fields.operator') },
      { prop: 'operationType', label: t('common.ops.logs.operation.fields.operation_type') },
      { prop: 'operationDesc', label: t('common.ops.logs.operation.fields.operation_desc') },
      { prop: 'tableName', label: t('common.ops.logs.operation.fields.table_name') },
      { prop: 'ipAddress', label: t('common.ops.logs.operation.fields.ip_address') },
      { prop: 'beforeData', label: t('common.ops.logs.operation.fields.before_data') }
    ];
  } else {
    return [
      { prop: 'requestTime', label: t('common.ops.logs.request.fields.create_time') },
      { prop: 'userName', label: t('common.ops.logs.request.fields.username') },
      { prop: 'requestUrl', label: t('common.ops.logs.request.fields.url') },
      { prop: 'method', label: t('common.ops.logs.request.fields.method') },
      { prop: 'ipAddress', label: t('common.ops.logs.request.fields.ip') },
      { prop: 'duration', label: t('common.ops.logs.request.fields.duration') },
      { prop: 'status', label: t('common.ops.logs.request.fields.status') },
      { prop: 'requestData', label: t('common.ops.logs.request.fields.request_data') },
      { prop: 'responseData', label: t('common.ops.logs.request.fields.response_data') }
    ];
  }
});

// 处理tab切换
const handleTabChange = (tab: any) => {
  activeTab.value = tab.name;
  console.info('[LogsCenter] tab-change →', tab.name, 'currentStorageKey =', currentStorageKey.value);
  // 等待渲染后再次打印
  nextTick(() => {
    console.info('[LogsCenter] after render, activeTab =', activeTab.value, 'storageKey =', currentStorageKey.value);
  });
};

// 首次进入打印一次
watch(
  () => activeTab.value,
  (val, oldVal) => {
    console.info('[LogsCenter] activeTab changed:', oldVal, '→', val, 'storageKey =', currentStorageKey.value);
  },
  { immediate: true },
);

// 处理按钮点击
const handleButtonClick = (result: any) => {
  if (result.action === 'viewDetail') {
    currentLog.value = result.data;
    detailVisible.value = true;
  }
};

// 格式化JSON
const formatJson = (jsonStr: string) => {
  if (!jsonStr) return '-';
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2);
  } catch (_error) {
    return jsonStr;
  }
};
</script>

<style lang="scss" scoped>


// 局部禁用下拉过渡，减少 ResizeObserver 回调链
:deep(.el-dropdown__list) {
  transition: none !important;
  animation: none !important;
}

.service-unavailable {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.json-view {
  background: var(--el-fill-color-lighter);
  padding: 15px;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
