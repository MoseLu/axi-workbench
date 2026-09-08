import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ControlPlaneState } from './ControlPlaneState';

describe('ControlPlaneState', () => {
  it('uses one clear offline state instead of a collection of empty data tables', () => {
    const markup = renderToStaticMarkup(
      <ControlPlaneState
        description="当前无法连接控制面；受管任务会在连接恢复后显示。"
        title="工作区暂不可用"
      />,
    );

    expect(markup).toContain('工作区暂不可用');
    expect(markup).toContain('当前无法连接控制面');
    expect(markup).not.toContain('axi-table');
  });

  it('uses an unobtrusive progress indicator while the snapshot is loading', () => {
    const markup = renderToStaticMarkup(
      <ControlPlaneState description="正在读取数据。" loading title="正在同步工作区" />,
    );

    expect(markup).toContain('正在同步工作区');
    expect(markup).toContain('ant-spin');
    expect(markup).not.toContain('ant-empty');
  });
});
