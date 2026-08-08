import React from 'react';
import { Empty, Spin } from 'antd';

type ControlPlaneStateProps = {
  description: string;
  loading?: boolean;
  title: string;
};

/**
 * 控制面未连接时的统一空态。
 *
 * 不把“尚无数据”伪装成三张空表，也不泄漏网关的原始错误文本；连接恢复后，
 * 各页面仍渲染自身的真实表格与数据。
 */
export function ControlPlaneState({
  description,
  loading = false,
  title,
}: ControlPlaneStateProps) {
  return (
    <section aria-live="polite" className="wb-control-plane-state" role="status">
      {loading ? <Spin size="small" /> : <Empty description={null} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}
