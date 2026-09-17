import React from 'react';
import { StaticRouter } from 'react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import LegalDocument from './pages/LegalDocument';

export function renderLegalDocument(kind: 'terms' | 'privacy') {
  return renderToStaticMarkup(
    <StaticRouter location={`/legal/${kind}`}>
      <LegalDocument kind={kind} />
    </StaticRouter>,
  );
}
