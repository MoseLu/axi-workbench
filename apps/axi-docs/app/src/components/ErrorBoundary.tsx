import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', gap: 'var(--axi-docs-spacing-4)',
          color: 'var(--axi-docs-color-text-muted)', fontSize: 'var(--axi-docs-font-size-md)', padding: 'var(--axi-docs-spacing-7)',
        }}>
          <div style={{ fontSize: 'var(--axi-docs-font-size-3xl)' }}>⚠️</div>
          <div>页面出现错误，请刷新重试</div>
          {this.state.error && (
            <div style={{ fontSize: 'var(--axi-docs-font-size-sm)', opacity: 0.6 }}>{this.state.error.message}</div>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 'var(--axi-docs-spacing-3)', padding: 'var(--axi-docs-spacing-2) var(--axi-docs-spacing-5)', borderRadius: 'var(--axi-docs-radius-sm)',
              border: '1px solid var(--axi-docs-color-border)', cursor: 'pointer',
              background: 'var(--axi-docs-color-bg-secondary)', color: 'var(--axi-docs-color-text)',
            }}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
