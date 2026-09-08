import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { DesktopSettingsPage } from './DesktopSettingsPage';

describe('DesktopSettingsPage', () => {
  it('uses the desktop CRUD split workspace instead of the retired mobile subpage chrome', () => {
    const markup = renderToStaticMarkup(
      <StaticRouter location="/admin/me/theme">
        <DesktopSettingsPage activeKey="/admin/me/theme" title="主题外观">
          <div>内容</div>
        </DesktopSettingsPage>
      </StaticRouter>,
    );

    expect(markup).toContain('axi-filter-group');
    expect(markup).toContain('axi-master-list');
    expect(markup).toContain('系统设置');
    expect(markup).not.toContain('个人中心');
    expect(markup).not.toContain('通知中心');
    expect(markup).not.toContain('wb-me-sub');
  });
});
