import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { normalizeRouterBasename } from './lib/routes'
import './styles/index.css'
import type { InitialPageData } from './lib/initialPageData'
import { installFaviconNavigationState, setReadyFavicon } from './lib/favicon'

const routerBasename = normalizeRouterBasename(import.meta.env.BASE_URL)
const initialData: InitialPageData | undefined = window.__AXI_DOCS_INITIAL_DATA__
const root = document.getElementById('root')!
setReadyFavicon()
installFaviconNavigationState()

const app = (
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        <App initialData={initialData} />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)

if (root.hasChildNodes() && initialData) {
  ReactDOM.hydrateRoot(root, app)
} else {
  ReactDOM.createRoot(root).render(app)
}
