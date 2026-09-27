import React from 'react';
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
import '@axi/tokens/css';
import '@axi/core/styles.css';
import '@axi/crud/styles.css';
import '@axi/shell/styles.css';
import '@axi/settings/styles.css';
import '@axi/widgets/styles.css';
import App from './App';
import { installTauriGatewayFetch } from './lib/tauriGateway';
import './index.css';

installTauriGatewayFetch();

// Adopt the workspace observability SDK for the webview side. The
// SDK intercepts `console.*` plus global errors / unhandled rejections
// and posts JSON batches to the control-plane ingest endpoint exposed
// by api-gateway under `/api/observability/ingest`. The env variable
// defaults to the production-style URL but falls back to a no-op when
// not configured so dev installs without the gateway still run.
const observabilityIngestUrl =
  (import.meta.env.VITE_AXI_OBSERVABILITY_INGEST_URL as string | undefined) ??
  '/api/observability/ingest';
if (observabilityIngestUrl) {
  void import('@axi/observability-web').then(({ installWeb }) => {
    installWeb({
      service: 'axi-workbench-web',
      env: (import.meta.env.MODE as string) || 'dev',
      ingestUrl: observabilityIngestUrl,
    });
  });
}

// Dev-only: cross-check every `@axi/*` import in src/ against
// `foundation/axi-ui/docs/axi-ui/public-api.snapshot.json`. Vite tree-shakes
// the dynamic import out of production bundles because the module is reached
// exclusively through this `import.meta.env.DEV` branch.
if (import.meta.env.DEV) {
  void import('./lib/axi-ui-capability-check').then((m) => m.runAxiUiCapabilityCheck());
}

const root = document.getElementById('root');
if (!root) throw new Error('Workbench root element is missing');

type RuntimeErrorBoundaryState = { error: Error | null };

class RuntimeErrorBoundary extends React.Component<React.PropsWithChildren, RuntimeErrorBoundaryState> {
  state: RuntimeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 32,
          boxSizing: 'border-box',
          background: 'var(--axi-bg-page, #1d1d1d)',
          color: 'var(--axi-text, #f1f5f9)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <section style={{ maxWidth: 720, textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>工作台加载失败</h1>
          <p style={{ margin: '0 0 20px', color: 'var(--axi-text-secondary, #94a3b8)' }}>
            页面初始化时发生异常，请重新加载；错误信息已记录。
          </p>
          <pre
            style={{
              margin: 0,
              padding: 16,
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              color: '#fca5a5',
              background: 'rgba(127, 29, 29, .24)',
              border: '1px solid rgba(248, 113, 113, .36)',
              borderRadius: 10,
            }}
          >
            {this.state.error.message}
          </pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 20 }}>
            重新加载
          </button>
        </section>
      </main>
    );
  }
}

createRoot(root).render(
  <React.StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </React.StrictMode>,
);
