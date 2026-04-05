"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

const STORAGE_KEY = "academi:onboarded:v1";

export interface OnboardingStep {
  title: string;
  body: ReactNode;
  icon: string;
  primaryAction?: { label: string; href?: string; onClick?: () => void };
}

const DEFAULT_STEPS: OnboardingStep[] = [
  {
    icon: "👋",
    title: "논문집필 도우미에 오신 것을 환영합니다",
    body: (
      <>
        AI 기반 논문 수집과 노트 정리로 연구 시간을 획기적으로 줄여보세요.
        4단계에 걸쳐 주요 기능을 안내해 드립니다.
      </>
    ),
  },
  {
    icon: "📄",
    title: "1단계 · 연구 노트 작성",
    body: (
      <>
        <strong className="text-slate-900 dark:text-slate-100">연구</strong>
        {" "}메뉴에서 키워드로 논문을 수집하고, 인용문을 바로 노트에 드래그하여
        초안을 빠르게 만들 수 있습니다.
      </>
    ),
    primaryAction: { label: "연구 시작하기", href: "/research" },
  },
  {
    icon: "🤍",
    title: "2단계 · 북마크 & 컬렉션",
    body: (
      <>
        흥미로운 논문은{" "}
        <strong className="text-slate-900 dark:text-slate-100">북마크</strong>
        하고, 주제별{" "}
        <strong className="text-slate-900 dark:text-slate-100">컬렉션</strong>으로
        묶어 관리하세요. 태그로도 빠르게 찾을 수 있습니다.
      </>
    ),
  },
  {
    icon: "🔍",
    title: "3단계 · 추가 분석 도구",
    body: (
      <>
        <strong className="text-slate-900 dark:text-slate-100">건강검진</strong>
        으로 노트 품질을,{" "}
        <strong className="text-slate-900 dark:text-slate-100">갭 분석</strong>으로
        연구 공백을,{" "}
        <strong className="text-slate-900 dark:text-slate-100">설문 생성</strong>
        으로 인터뷰 문항을 자동 생성할 수 있습니다.
      </>
    ),
  },
  {
    icon: "🚀",
    title: "4단계 · 이제 시작해 보세요",
    body: (
      <>
        무료 플랜은 월 3회 수집이 포함됩니다. 더 많은 작업이 필요하면 언제든{" "}
        <strong className="text-slate-900 dark:text-slate-100">플랜 업그레이드</strong>
        를 확인해 보세요.
      </>
    ),
    primaryAction: { label: "첫 연구 노트 만들기", href: "/research" },
  },
];

/** localStorage 에서 완료 여부를 확인. */
export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

/** 완료 플래그를 저장. */
function markOnboardingComplete() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* quota exceeded / private mode — silent */
  }
}

/** 완료 플래그를 삭제 (온보딩 다시 보기용). */
export function resetOnboarding() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 4~5단계 신규 사용자 가이드.
 * - 자동 표시: `auto` prop 이 true이면 localStorage 체크 후 첫 렌더에 표시.
 * - `onClose` 호출 시 completion flag 저장.
 * - ESC/오버레이 클릭/Skip 으로 닫을 수 있음 (포커스 트랩 적용).
 */
export default function Onboarding({
  steps = DEFAULT_STEPS,
  auto = true,
  open: controlledOpen,
  onClose: controlledClose,
}: {
  steps?: OnboardingStep[];
  auto?: boolean;
  open?: boolean;
  onClose?: () => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // 자동 표시: mount 후 localStorage 확인
  useEffect(() => {
    if (isControlled || !auto) return;
    if (!isOnboardingComplete()) {
      setInternalOpen(true);
    }
  }, [isControlled, auto]);

  const close = useCallback(() => {
    markOnboardingComplete();
    setIndex(0);
    if (isControlled) {
      controlledClose?.();
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, controlledClose]);

  // 포커스 트랩 + ESC 닫기 + 좌우 화살표
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, steps.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 다이얼로그에 초기 포커스
    const root = dialogRef.current;
    if (root) {
      const first = root.querySelector<HTMLElement>(
        'button:not([disabled]), a[href]',
      );
      (first ?? root).focus();
    }

    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, close, steps.length]);

  if (!open) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const progress = ((index + 1) / steps.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="onboarding-dialog"
        tabIndex={-1}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl outline-none dark:bg-slate-900"
      >
        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`진행률: ${steps.length}단계 중 ${index + 1}단계`}
          className="h-1 w-full bg-slate-100 dark:bg-slate-800"
        >
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-8 py-8 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            {step.icon}
          </div>
          <h2
            id={titleId}
            className="text-xl font-bold text-slate-900 dark:text-slate-100"
          >
            {step.title}
          </h2>
          <p
            id={descId}
            className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
          >
            {step.body}
          </p>

          {step.primaryAction && (
            <div className="mt-5">
              {step.primaryAction.href ? (
                <Link
                  href={step.primaryAction.href}
                  onClick={close}
                  className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  {step.primaryAction.label} →
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    step.primaryAction?.onClick?.();
                    close();
                  }}
                  className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                >
                  {step.primaryAction.label}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition ${
                  i === index
                    ? "w-4 bg-blue-600"
                    : i < index
                      ? "bg-blue-300"
                      : "bg-slate-300 dark:bg-slate-700"
                }`}
                aria-hidden="true"
              />
            ))}
            <span className="sr-only">
              {steps.length}단계 중 {index + 1}단계
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:text-slate-200"
            >
              건너뛰기
            </button>
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                이전
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isLast) close();
                else setIndex((i) => Math.min(i + 1, steps.length - 1));
              }}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
            >
              {isLast ? "시작하기" : "다음"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
