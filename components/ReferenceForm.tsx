"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  createReference,
  updateReference,
  type ReferenceCreateData,
  type ReferenceUpdateData,
  ApiError,
} from "@/lib/api";

interface ReferenceFormProps {
  referenceId?: string;
  initial?: {
    title?: string;
    authors?: string | null;
    journal?: string | null;
    year?: number | null;
    doi?: string | null;
    citation_text?: string | null;
    memo?: string | null;
  };
  onSaved?: () => void;
}

export default function ReferenceForm({
  referenceId,
  initial,
  onSaved,
}: ReferenceFormProps) {
  const { data: session } = useSession();
  const isEdit = !!referenceId;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [authors, setAuthors] = useState(initial?.authors ?? "");
  const [journal, setJournal] = useState(initial?.journal ?? "");
  const [year, setYear] = useState(initial?.year?.toString() ?? "");
  const [doi, setDoi] = useState(initial?.doi ?? "");
  const [citationText, setCitationText] = useState(initial?.citation_text ?? "");
  const [memo, setMemo] = useState(initial?.memo ?? "");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const token = session?.accessToken;
    if (!token) {
      setError("로그인이 필요합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const yearNum = year ? parseInt(year, 10) : null;

      if (isEdit) {
        const data: ReferenceUpdateData = {
          title: title.trim(),
          authors: authors || null,
          journal: journal || null,
          year: yearNum,
          doi: doi || null,
          citation_text: citationText || null,
          memo: memo || null,
        };
        await updateReference(referenceId, data, token);
        setMessage("참고문헌이 수정되었습니다.");
      } else {
        const data: ReferenceCreateData = {
          title: title.trim(),
          authors: authors || null,
          journal: journal || null,
          year: yearNum,
          doi: doi || null,
          citation_text: citationText || null,
          memo: memo || null,
        };
        await createReference(data, token);
        setMessage("참고문헌이 추가되었습니다.");
        setTitle("");
        setAuthors("");
        setJournal("");
        setYear("");
        setDoi("");
        setCitationText("");
        setMemo("");
      }
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("참고문헌 저장 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800";

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목 *"
              required
              className={inputClass}
            />
          </div>
          <input
            type="text"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="저자"
            className={inputClass}
          />
          <input
            type="text"
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            placeholder="학술지"
            className={inputClass}
          />
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="연도"
            className={inputClass}
          />
          <input
            type="text"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="DOI"
            className={inputClass}
          />
          <div className="sm:col-span-2">
            <textarea
              value={citationText}
              onChange={(e) => setCitationText(e.target.value)}
              placeholder="인용 텍스트 (APA, MLA 등)"
              rows={2}
              className={`resize-y ${inputClass}`}
            />
          </div>
          <div className="sm:col-span-2">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모"
              rows={2}
              className={`resize-y ${inputClass}`}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="shrink-0 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "저장 중..." : isEdit ? "수정" : "참고문헌 추가"}
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
