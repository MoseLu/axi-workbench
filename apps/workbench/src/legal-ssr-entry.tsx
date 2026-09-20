import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import LegalDocument from './pages/LegalDocument';

/**
 * Render a legal-document HTML string for SSR.
 *
 * react-router 7 dropped the bare <StaticRouter> location-context
 * shape that <Link>'s LinkWithRef consumes via useContext();
 * `<Link>` now reads the location from RouterProvider. Use the
 * data-router API (createMemoryRouter + RouterProvider) so the
 * rendered tree has a real router provider and LinkWithRef can
 * resolve its context.
 *
 * The <StaticRouter> shape that worked under react-router 6 no
 * longer carries a usable location for `<Link>` in react-router 7
 * (see WFB-ROUTER-001); this is the minimal-change migration that
 * keeps the public API (`renderLegalDocument(kind)` -> string) intact
 * while making the SSR render compatible with the v7 router.
 */
export function renderLegalDocument(kind: 'terms' | 'privacy') {
  const router = createMemoryRouter(
    [
      {
        path: `/legal/${kind}`,
        element: <LegalDocument kind={kind} />,
      },
    ],
    { initialEntries: [`/legal/${kind}`] },
  );
  return renderToStaticMarkup(<RouterProvider router={router} />);
}
