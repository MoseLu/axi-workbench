import React from 'react';
import { AxiCrudLayout } from '@axi/crud';
import type { AxiCrudAction } from '@axi/crud';
import './DesktopCrudFrame.css';

type DesktopCrudFrameProps = {
  /** 主区域无障碍标签。 */
  ariaLabel: string;
  /** Cool Admin 标准 CRUD 页标题。 */
  title?: React.ReactNode;
  /** 标题下的资源说明或当前查询上下文。 */
  description?: React.ReactNode;
  /**
   * Cool Admin 风格左侧主操作：刷新 / 新增 / 删除 等。
   * 也可用 `actions` 结构化声明。
   */
  toolbar?: React.ReactNode;
  /** 结构化主操作按钮（渲染在工具栏左侧）。 */
  actions?: AxiCrudAction[];
  /** 批量操作区（依赖行选择时展示）。 */
  bulkActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** 筛选字段：组织、类型、状态下拉等。 */
  filters?: React.ReactNode;
  /** 底部分页条；不传时使用表格内置分页。 */
  footer?: React.ReactNode;
  /** 查询动作：搜索 / 重置。 */
  queryActions?: React.ReactNode;
  /** 关键字搜索输入（工具栏右侧）。 */
  search?: React.ReactNode;
  selectionCount?: number;
  selectionLabel?: React.ReactNode;
  /** 自定义左侧前置内容（租户切换等）。 */
  top?: React.ReactNode;
};

/**
 * Web 管理端 Cool Admin 风格数据页骨架。
 *
 * 布局约定（对齐 cl-crud）：
 * - 左：主操作（刷新 / 新增 / 删除）
 * - 中：筛选字段
 * - 右：搜索 + 查询按钮
 * - 中部：表格
 * - 底：分页（可选）
 */
export function DesktopCrudFrame({
  actions,
  ariaLabel,
  bulkActions,
  children,
  className = '',
  description,
  filters,
  footer,
  queryActions,
  search,
  selectionCount,
  selectionLabel,
  toolbar,
  top,
  title,
}: DesktopCrudFrameProps) {
  return (
    <main aria-label={ariaLabel} className={`wb-crud-page ${className}`.trim()}>
      <AxiCrudLayout
        actions={actions}
        bulkActions={bulkActions}
        className="wb-crud-page__layout"
        description={description}
        filters={filters}
        footer={footer}
        queryActions={queryActions}
        search={search}
        selectionCount={selectionCount}
        selectionLabel={selectionLabel}
        toolbar={toolbar}
        top={top}
        title={title}
      >
        {children}
      </AxiCrudLayout>
    </main>
  );
}
