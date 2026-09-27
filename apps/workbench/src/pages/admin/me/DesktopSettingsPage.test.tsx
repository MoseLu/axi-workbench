import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DesktopSettingsPage } from './DesktopSettingsPage';

/**
 * WFB-ROUTER-001: react-router 7 moved the location context into
 * RouterProvider. The original test used the v6 <StaticRouter>
 * shape which leaves useNavigate() consumers without a context.
 *
 * react-router 7 in jsdom under vitest 4 still raises an internal
 * "Cannot read properties of null (reading 'unstable_runWithPriority')"
 * during RouterProvider mount when the test environment does not
 * pre-allocate the React scheduler hook. Switching to the
 * jsdom-friendly entry point (createMemoryRouter + RouterProvider
 * with the same route definition the page actually serves) gives
 * the consumer tree a usable location. The test renders to static
 * markup under that provider; the markup assertions match the
 * pre-existing intent.
 */
describe('DesktopSettingsPage (react-router 7 data router)', () => {
  it('uses the desktop CRUD split workspace instead of the retired mobile subpage chrome', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/admin/me/:key',
          element: (
            <DesktopSettingsPage activeKey="/admin/me/theme" title="主题外观">
              <div>内容</div>
            </DesktopSettingsPage>
          ),
        },
      ],
      { initialEntries: ['/admin/me/theme'] },
    );
    const markup = renderToStaticMarkup(<RouterProvider router={router} />);

    expect(markup).toContain('axi-filter-group');
    expect(markup).toContain('axi-master-list');
    expect(markup).toContain('系统设置');
    expect(markup).not.toContain('个人中心');
    expect(markup).not.toContain('通知中心');
    expect(markup).not.toContain('wb-me-sub');
  });
});
