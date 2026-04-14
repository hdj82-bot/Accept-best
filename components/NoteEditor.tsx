"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { createNote, updateNote, ApiError } from "@/lib/api";

export default function NoteEditor({
  noteId,
  initialContent,
  onSaved,
}: {
  noteId?: string;
  initialContent?: string;
  onSaved?: () => void;
}) {
  const { data: session } = useSession();
  const [content, setContent] = useState(initialContent ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isEdit = !!noteId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    const token = (session as any)?.accessToken as string | undefined;
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isEdit) {
        await updateNote(noteId, trimmed, token);
        setMessage("노트가 수정되었습니다.");
      } else {
        await createNote(trimmed, token);
        setMessage("노트가 저장되었습니다.");
        setContent("");
      }
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("노트 저장 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="연구 노트를 작성하세요..."
          rows={6}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "저장 중..." : isEdit ? "수정" : "새 노트 저장"}
          </button>
        </div>
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
