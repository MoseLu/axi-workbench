import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error legal HTML helper is untyped JS
import { createLegalDocumentHtml } from '../scripts/legal-page-html.mjs';
import { renderLegalDocument } from './legal-ssr-entry';

// Non-router assertions for the legal-document SSR pipeline. These
// tests exercise the SSR markup generator and the SPA-exclusion
// contract directly; they do not touch react-router and are stable
// across the v6 -> v7 cutover.
describe('legal document SSR and hydrate trees', () => {
  it('renders terms of service without I18nProvider', () => {
    const html = renderLegalDocument('terms');
    expect(html).toContain('axi-legal-page');
    expect(html).toContain('axi-legal-nav');
    expect(html).toContain('axi-legal-toc__viewport');
    expect(html).toContain('公理工作台服务条款');
    expect(html).toContain('法律文档');
    expect(html).toContain('欢迎使用 公理工作台');
    expect(html).toContain('href="#service"');
    expect(html).toContain('id="service"');
    expect(html).toContain('href="#changes"');
    expect(html).toContain('id="changes"');
  });

  it('renders the privacy policy without I18nProvider', () => {
    const html = renderLegalDocument('privacy');
    expect(html).toContain('公理工作台隐私政策');
    expect(html).toContain('本政策说明 公理工作台');
  });

  it('does not boot the SPA JavaScript bundle on legal documents', () => {
    const html = createLegalDocumentHtml({
      kind: 'terms',
      markup: '<main class="axi-legal-page">条款</main>',
      assets: { css: ['/assets/index.css'], js: ['/assets/index.js'] },
    });

    expect(html).toContain('公理工作台服务条款');
    expect(html).toContain('/assets/index.css');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('/assets/index.js');
  });

  it('selects the in-page nav item from the targeted heading', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'pages/LegalDocument.css'),
      'utf8',
    );
    expect(css).toContain('.axi-legal-page:has(#changes:target) .axi-legal-toc a[href="#changes"]');
    expect(css).not.toMatch(/\.axi-legal-toc a:first-of-type \{/);
    expect(css).toMatch(/\.axi-legal-sidebar \{[^}]*position: fixed;/s);
    expect(css).toMatch(/\.axi-legal-nav \{[^}]*position: fixed;/s);
    expect(css).toMatch(/\.axi-legal-toc__viewport \{[^}]*position: fixed;/s);
  });
});

// The original "renders the legal document in a router without
// I18nProvider" assertion was a pre-existing failure that
// required the react-router 7 data-router migration. With react-router
// 7 in place, <Link>'s LinkWithRef useContext() reads the location
// from RouterProvider, not from <MemoryRouter>. The original test
// used the v6 <MemoryRouter> + <Routes> + <Route> shape; the v7
// equivalent is createMemoryRouter + RouterProvider + a route
// definition. Re-enable the router test below with the v7 data
// router API. The I18nProvider bit is dropped because LegalDocument
// does not depend on i18n; it renders zh-CN copy from a JSON import
// directly. (Skipping the provider here is consistent with the
// "without I18nProvider" branch that the original test name
// described.)
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LegalDocument from './pages/LegalDocument';

describe('legal document SSR and hydrate trees (react-router 7 data router)', () => {
  it('renders the legal document in a router', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/legal/terms',
          element: <LegalDocument kind="terms" />,
        },
      ],
      { initialEntries: ['/legal/terms'] },
    );
    render(<RouterProvider router={router} />);

    expect(
      screen.getByRole('heading', { name: '公理工作台服务条款' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '公理工作台' })).toBeInTheDocument();
  });
});
