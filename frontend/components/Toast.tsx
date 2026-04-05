"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * 전역 Toast Provider.
 * - `role="status"` + `aria-live="polite"` 로 비간섭 알림
 * - 오류 토스트는 `role="alert"` + `aria-live="assertive"` 로 즉시 안내
 * - 4초 후 자동 해제, 사용자가 수동 해제도 가능
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, type }]);
      window.setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  dismiss,
}: {
  items: ToastItem[];
  dismiss: (id: number) => void;
}) {
  return (
    <div
      aria-label="알림"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {items.map((t) => (
        <ToastNode key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastNode({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const color =
    item.type === "success"
      ? "bg-emerald-600"
      : item.type === "error"
        ? "bg-red-600"
        : "bg-slate-800";
  const isAlert = item.type === "error";

  return (
    <div
      role={isAlert ? "alert" : "status"}
      aria-live={isAlert ? "assertive" : "polite"}
      className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-xl ${color} px-4 py-2.5 text-sm font-medium text-white shadow-lg`}
    >
      <span className="flex-1">{item.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="알림 닫기"
        className="rounded-md px-1 text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        ✕
      </button>
    </div>
  );
}

/** Toast 컨텍스트 훅. Provider 외부에서 호출 시 no-op 으로 fallback. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  // Provider가 아직 마운트되지 않았을 때를 위한 안전 장치
  return {
    toast: (msg) => {
      if (typeof window !== "undefined") console.warn("[Toast]", msg);
    },
    dismiss: () => undefined,
  };
}

/**
 * 페이지 전환 시 URL 쿼리로 전달된 `?toast=...&type=...` 을 표시하는 헬퍼.
 * 서버 리다이렉트 직후 토스트를 띄우고 싶을 때 사용.
 */
export function useToastFromQuery() {
  const { toast } = useToast();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("toast");
    const type = (params.get("toastType") as ToastType | null) ?? "info";
    if (msg) {
      toast(decodeURIComponent(msg), type);
      params.delete("toast");
      params.delete("toastType");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      window.history.replaceState(null, "", next);
    }
  }, [toast]);
}
