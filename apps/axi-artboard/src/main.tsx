import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// CSS pipeline order matters: tailwind first (so utilities + @theme
// tokens resolve), then the SCSS index (which @use's tokens.scss).
import './styles/tailwind.css'
import './index.scss'
import App from './App.tsx'

// Adopt the workspace observability SDK for the webview side — see
// foundation/axi-observability/web for the installWeb contract.
const __axiIngestUrl =
  (import.meta.env.VITE_AXI_OBSERVABILITY_INGEST_URL as string | undefined) ??
  '/api/observability/ingest';
if (__axiIngestUrl) {
  void import('@axi/observability-web').then(({ installWeb }) => {
    installWeb({
      service: 'axi-artboard-web',
      env: (import.meta.env.MODE as string) || 'dev',
      ingestUrl: __axiIngestUrl,
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
