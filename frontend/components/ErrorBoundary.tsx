"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React class-based error boundary.
 * - Shows user-friendly error message with retry button
 * - Displays error stack in development
 * - Resets state on "다시 시도" click
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to Sentry; here we just log
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30">
        <div className="text-4xl">⚠️</div>
        <div>
          <p className="font-semibold text-red-800 dark:text-red-300">
            오류가 발생했습니다
          </p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            잠시 후 다시 시도해 주세요.
          </p>
        </div>

        {/* Dev-only stack trace */}
        {process.env.NODE_ENV !== "production" && this.state.error && (
          <details className="mt-2 max-w-lg text-left">
            <summary className="cursor-pointer text-xs text-red-500">
              오류 상세 (개발 환경)
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-red-100 p-3 text-[10px] leading-relaxed text-red-800 dark:bg-red-900/50 dark:text-red-200">
              {this.state.error.stack}
            </pre>
          </details>
        )}

        <button
          onClick={this.handleReset}
          className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          다시 시도
        </button>
      </div>
    );
  }
}
