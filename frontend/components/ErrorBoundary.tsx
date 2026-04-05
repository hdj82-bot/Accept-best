"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  /** 선택적 커스텀 fallback UI */
  fallback?: ReactNode;
  /** 오류 리포팅 시 붙일 태그 (구역 구분용) */
  scope?: string;
  /** 리셋 시 호출되는 콜백 */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  eventId: string | null;
}

/**
 * React class-based error boundary.
 * - 렌더 오류 캐치 + 사용자 친화 메시지
 * - 프로덕션: Sentry에 자동 보고 + eventId 기반 "피드백 보내기" 링크
 * - 개발: 오류 스택 노출
 * - "다시 시도" 로 state 리셋 + onReset 콜백 호출
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, eventId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
    const eventId = Sentry.captureException(error, {
      tags: this.props.scope ? { scope: this.props.scope } : undefined,
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, eventId: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="mx-auto my-8 flex min-h-[200px] max-w-xl flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30"
      >
        <div className="text-4xl" aria-hidden="true">
          ⚠️
        </div>
        <div>
          <p className="font-semibold text-red-800 dark:text-red-300">
            오류가 발생했습니다
          </p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
          </p>
          {this.state.eventId && (
            <p className="mt-2 text-[11px] text-red-500/80 dark:text-red-400/70">
              오류 ID: <code className="font-mono">{this.state.eventId}</code>
            </p>
          )}
        </div>

        {process.env.NODE_ENV !== "production" && this.state.error && (
          <details className="mt-2 max-w-lg text-left">
            <summary className="cursor-pointer text-xs text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              오류 상세 (개발 환경)
            </summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-red-100 p-3 text-[10px] leading-relaxed text-red-800 dark:bg-red-900/50 dark:text-red-200">
              {this.state.error.stack}
            </pre>
          </details>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="rounded-xl border border-red-300 px-5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-500 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    );
  }
}
