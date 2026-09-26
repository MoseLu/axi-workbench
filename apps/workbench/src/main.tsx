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
