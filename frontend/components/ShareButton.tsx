"use client";

import { useEffect, useRef, useState } from "react";
import {
  getMyShareTokens,
  createShareToken,
  revokeShareToken,
  type ShareToken,
} from "@/lib/api";

interface ShareButtonProps {
  noteId: string;
}

type ExpiryOption = { label: string; days?: number };

const EXPIRY_OPTIONS: ExpiryOption[] = [
  { label: "7일",   days: 7 },
  { label: "30일",  days: 30 },
  { label: "무기한" },
];

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2_500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}

/**
 * Share button with expiry selector, clipboard copy, and token revoke.
 *
 * Props:
 *   noteId — the note to share
 *
 * Behaviour:
 *   - On mount: checks if an active token already exists via getMyShareTokens()
 *   - If token exists: "공유 링크 복사" copies URL directly (no re-generation)
 *   - If no token: shows expiry dropdown, then creates token on confirm
 *   - "링크 해제" revokes the current token
 */
export default function ShareButton({ noteId }: ShareButtonProps) {
  const [token, setToken] = useState<ShareToken | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<ExpiryOption>(EXPIRY_OPTIONS[0]);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load existing token for this note
  useEffect(() => {
    getMyShareTokens()
      .then((tokens) => {
        const existing = tokens.find(
          (t) => t.note_id === noteId && t.is_active,
        );
        setToken(existing ?? null);
      })
      .catch(() => null)
      .finally(() => setLoadingToken(false));
  }, [noteId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const shareUrl = (t: ShareToken) =>
    `${window.location.origin}/share/${t.token}`;

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setToast("링크가 복사되었습니다!");
    } catch {
      setToast("복사 실패 — URL을 직접 복사하세요.");
    }
    setOpen(false);
  };

  const handleCreateAndCopy = async () => {
    setCreating(true);
    try {
      const newToken = await createShareToken(noteId, selectedExpiry.days);
      setToken(newToken);
      await copyToClipboard(shareUrl(newToken));
    } catch {
      setToast("링크 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!token) return;
    if (!confirm("공유 링크를 해제하시겠습니까? 기존 링크로는 더 이상 접근할 수 없습니다.")) return;
    setRevoking(true);
    try {
      await revokeShareToken(token.token);
      setToken(null);
      setToast("공유 링크가 해제되었습니다.");
    } catch {
      setToast("링크 해제에 실패했습니다.");
    } finally {
      setRevoking(false);
      setOpen(false);
    }
  };

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={loadingToken}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ShareIcon />
          공유
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {token ? (
              /* Existing token — copy or revoke */
              <>
                <div className="px-4 py-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    공유 중
                    {token.expires_at && (
                      <span className="ml-1 text-slate-400">
                        · {new Date(token.expires_at).toLocaleDateString("ko-KR")} 만료
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(shareUrl(token))}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>📋</span> 공유 링크 복사
                </button>
                <hr className="my-1 border-slate-100 dark:border-slate-700" />
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
                >
                  <span>🔗</span> {revoking ? "해제 중…" : "링크 해제"}
                </button>
              </>
            ) : (
              /* No token — select expiry and create */
              <>
                <div className="px-4 py-2">
                  <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    링크 만료 기간
                  </p>
                  <div className="flex gap-1">
                    {EXPIRY_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setSelectedExpiry(opt)}
                        className={`flex-1 rounded-lg border py-1 text-xs font-medium transition ${
                          selectedExpiry.label === opt.label
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-4 pb-2">
                  <button
                    onClick={handleCreateAndCopy}
                    disabled={creating}
                    className="w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {creating ? "생성 중…" : "링크 생성 및 복사"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5"  r="3" />
      <circle cx="6"  cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59"  y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51"  x2="8.59"  y2="10.49" />
    </svg>
  );
}
