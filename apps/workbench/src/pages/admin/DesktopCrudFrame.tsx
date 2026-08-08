import React from 'react';
import { AxiCrudLayout } from '@axi/crud';
import './DesktopCrudFrame.css';

type DesktopCrudFrameProps = {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
  search?: React.ReactNode;
  toolbar?: React.ReactNode;
  top?: React.ReactNode;
};

/**
 * Web 管理端的通用数据页骨架。
 *
 * 页面只提供 CRUD 工具栏和内容承载区；具体领域内容仍由各路由负责，避免
 * 把移动端的全宽列表样式复制到桌面页面。
 */
export function DesktopCrudFrame({ ariaLabel, children, className = '', search, toolbar, top }: DesktopCrudFrameProps) {
  return (
    <main aria-label={ariaLabel} className={`wb-crud-page ${className}`.trim()}>
      <AxiCrudLayout className="wb-crud-page__layout" search={search} toolbar={toolbar} top={top}>
        {children}
      </AxiCrudLayout>
    </main>
  );
}
