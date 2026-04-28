"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { runDiagnosis, ApiError } from "@/lib/api";

export default function DiagnosisRunForm({
  onStarted,
}: {
  onStarted?: () => void;
}) {
  const { data: session } = useSession();
  const [paperId, setPaperId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = paperId.trim();
    if (!trimmed) return;

    const token = session?.accessToken;
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const result = await runDiagnosis(trimmed, token);
      setMessage(result.message);
      setPaperId("");
      onStarted?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("건강검진 실행 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex w-full gap-3">
        <input
          type="text"
          value={paperId}
          onChange={(e) => setPaperId(e.target.value)}
          placeholder="논문 ID를 입력하세요"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
        />
        <button
          type="submit"
          disabled={loading || !paperId.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "실행 중..." : "건강검진 실행"}
        </button>
      </form>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
