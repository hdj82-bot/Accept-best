"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import NoteEditor from "@/components/NoteEditor";
import {
  getNote,
  deleteNote,
  noteToDraft,
  type ResearchNote,
  ApiError,
} from "@/lib/api";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "날짜 정보 없음";
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [note, setNote] = useState<ResearchNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = session?.accessToken;
    if (!token || !params.id) return;

    let cancelled = false;

    async function fetchNote() {
      setLoading(true);
      setError(null);
      try {
        const result = await getNote(params.id, token!);
        if (!cancelled) setNote(result);
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("노트를 불러오는 중 오류가 발생했습니다.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNote();
    return () => { cancelled = true; };
  }, [session, params.id]);

  async function handleDelete() {
    if (!note) return;
    const token = session?.accessToken;
    if (!token) return;

    setDeleting(true);
    try {
      await deleteNote(note.id, token);
      router.push("/notes");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("삭제 중 오류가 발생했습니다.");
      }
      setDeleting(false);
    }
  }

  async function handleToDraft() {
    if (!note) return;
    const token = session?.accessToken;
    if (!token) return;

    setConverting(true);
    setDraftMessage(null);
    setError(null);

    try {
      const result = await noteToDraft(note.id, token);
      setDraftMessage(result.message);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("초안 변환 중 오류가 발생했습니다.");
      }
    } finally {
      setConverting(false);
    }
  }

  function handleSaved() {
    const token = session?.accessToken;
    if (!token || !params.id) return;

    getNote(params.id, token).then(setNote).catch(() => {});
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-lg font-bold text-zinc-900 transition-colors hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
          >
            논문집필 도우미
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <Link
            href="/notes"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            연구 노트
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500">상세</span>
        </div>
        <UserMenu />
      </header>

      {/* 본문 */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
            <span className="ml-3 text-sm text-zinc-500 dark:text-zinc-400">
              노트를 불러오고 있습니다...
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {draftMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {draftMessage}
          </div>
        )}

        {note && (
          <>
            {/* 메타 정보 */}
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              {formatDate(note.created_at)}
            </div>

            {/* 편집기 */}
            <NoteEditor
              noteId={note.id}
              initialContent={note.content}
              onSaved={handleSaved}
            />

            {/* 액션 버튼 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleToDraft}
                disabled={converting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
                {converting ? "변환 중..." : "초안으로 변환"}
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:border-red-800 dark:hover:bg-red-950"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                {deleting ? "삭제 중..." : "노트 삭제"}
              </button>
            </div>

            {/* 뒤로가기 */}
            <div className="pt-4">
              <Link
                href="/notes"
                className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                목록으로 돌아가기
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
