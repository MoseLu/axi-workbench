import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Root-level error boundary for the devsvc-dashboard shell.
 *
 * Wraps the entire route tree so a render-time exception in any descendant
 * surfaces a friendly fallback UI instead of an empty white page. The
 * boundary also logs the captured error to the console for debugging and
 * exposes an `onError` hook so callers can pipe failures into the project
 * observability SDK or any toast layer that lives outside this subtree.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[AppErrorBoundary]", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="app-error-boundary"
          style={{ padding: 32, textAlign: "center", color: "var(--axi-color-text, inherit)" }}
        >
          <h2 style={{ marginBottom: 8 }}>页面遇到错误</h2>
          <p style={{ color: "var(--axi-color-text-secondary, #888)" }}>
            {this.state.error?.message ?? "未知错误"}
          </p>
          <div style={{ display: "inline-flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}
            >
              重试
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "var(--axi-color-primary, #1677ff)", color: "#fff", cursor: "pointer" }}
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
