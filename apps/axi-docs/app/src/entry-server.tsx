import React from 'react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import type { InitialPageData } from './lib/initialPageData'

export function renderPage(url: string, initialData: InitialPageData): string {
  return renderToString(
    <React.StrictMode>
      <ErrorBoundary>
        <MemoryRouter initialEntries={[url]}>
          <App initialData={initialData} />
        </MemoryRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}
