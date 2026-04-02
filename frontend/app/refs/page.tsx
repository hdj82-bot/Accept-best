"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import {
  getReferences,
  createReference,
  updateReference,
  deleteReference,
  exportBibtex,
  type Reference,
  type CreateReferenceData,
} from "@/lib/api";

export default function RefsPage() {
  return (
    <AuthGuard>
      <RefsContent />
    </AuthGuard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Toast
// ────────────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3_000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium shadow-lg ${
        type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {message}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Blank form state
// ────────────────────────────────────────────────────────────────────────────

const BLANK: CreateReferenceData = {
  title: "",
  authors: [],
  journal: "",
  year: undefined,
  doi: "",
  cite_key: "",
};

// ────────────────────────────────────────────────────────────────────────────
// Reference form (add or edit inline)
// ────────────────────────────────────────────────────────────────────────────

function RefForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: CreateReferenceData;
  onSave: (data: CreateReferenceData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const [authorsRaw, setAuthorsRaw] = useState(
    (initial.authors ?? []).join(", ")
  );

  const set = (k: keyof CreateReferenceData, v: string | number | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...form,
      authors: authorsRaw
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          제목 *
        </label>
        <input
          required
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="논문 제목"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          저자 (쉼표 구분)
        </label>
        <input
          value={authorsRaw}
          onChange={(e) => setAuthorsRaw(e.target.value)}
          placeholder="홍길동, 김철수"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            저널
          </label>
          <input
            value={form.journal ?? ""}
            onChange={(e) => set("journal", e.target.value)}
            placeholder="Nature"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            연도
          </label>
          <input
            type="number"
            value={form.year ?? ""}
            onChange={(e) =>
              set("year", e.target.value ? parseInt(e.target.value) : "")
            }
            placeholder="2024"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            DOI
          </label>
          <input
            value={form.doi ?? ""}
            onChange={(e) => set("doi", e.target.value)}
            placeholder="10.1234/example"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Cite Key
          </label>
          <input
            value={form.cite_key ?? ""}
            onChange={(e) => set("cite_key", e.target.value)}
            placeholder="hong2024"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-blue-400 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          취소
        </button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Reference card
// ────────────────────────────────────────────────────────────────────────────

function RefCard({
  ref: r,
  onEdit,
  onDelete,
}: {
  ref: Reference;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            {r.title}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {r.authors.join(", ")}
            {r.journal ? ` · ${r.journal}` : ""}
            {r.year ? ` ${r.year}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            {r.doi && (
              <a
                href={`https://doi.org/${r.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                DOI: {r.doi}
              </a>
            )}
            {r.cite_key && (
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono dark:bg-slate-800">
                {r.cite_key}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            수정
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main content
// ────────────────────────────────────────────────────────────────────────────

function RefsContent() {
  const [refs, setRefs] = useState<Reference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => setToast({ message, type }),
    []
  );

  const reload = useCallback(() => {
    getReferences().then(setRefs).catch(() => null).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleCreate = async (data: CreateReferenceData) => {
    setSaving(true);
    try {
      const created = await createReference(data);
      setRefs((rs) => [created, ...rs]);
      setShowAddForm(false);
      showToast("참고문헌이 추가되었습니다.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "추가 실패", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, data: CreateReferenceData) => {
    setSaving(true);
    try {
      const updated = await updateReference(id, data);
      setRefs((rs) => rs.map((r) => (r.id === id ? updated : r)));
      setEditingId(null);
      showToast("수정되었습니다.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "수정 실패", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 참고문헌을 삭제하시겠습니까?")) return;
    try {
      await deleteReference(id);
      setRefs((rs) => rs.filter((r) => r.id !== id));
      showToast("삭제되었습니다.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "삭제 실패", "error");
    }
  };

  const handleExport = async () => {
    try {
      const bibtex = await exportBibtex();
      await navigator.clipboard.writeText(bibtex);
      showToast("BibTeX가 클립보드에 복사되었습니다.", "success");
    } catch {
      showToast("내보내기 실패", "error");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              ← 대시보드
            </Link>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              참고문헌 관리
            </h1>
          </div>
          <button
            onClick={handleExport}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            BibTeX 내보내기
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Add button / form */}
        {showAddForm ? (
          <div className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm dark:border-blue-800 dark:bg-slate-900">
            <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
              새 참고문헌 추가
            </h2>
            <RefForm
              initial={BLANK}
              onSave={handleCreate}
              onCancel={() => setShowAddForm(false)}
              saving={saving}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-400"
          >
            + 참고문헌 추가
          </button>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        ) : refs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              참고문헌이 없습니다.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              위의 버튼을 눌러 추가해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {refs.map((r) =>
              editingId === r.id ? (
                <div
                  key={r.id}
                  className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm dark:border-blue-800 dark:bg-slate-900"
                >
                  <RefForm
                    initial={{
                      title: r.title,
                      authors: r.authors,
                      journal: r.journal ?? "",
                      year: r.year ?? undefined,
                      doi: r.doi ?? "",
                      cite_key: r.cite_key ?? "",
                    }}
                    onSave={(data) => handleUpdate(r.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <RefCard
                  key={r.id}
                  ref={r}
                  onEdit={() => setEditingId(r.id)}
                  onDelete={() => handleDelete(r.id)}
                />
              )
            )}
          </div>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </main>
  );
}
