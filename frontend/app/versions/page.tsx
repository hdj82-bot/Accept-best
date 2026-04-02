"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { listVersions, restoreVersion, type PaperVersion } from "@/lib/api";

export default function VersionsPage() {
  return (
    <AuthGuard>
      <VersionsContent />
    </AuthGuard>
  );
}

function VersionsContent() {
  const router = useRouter();
  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    listVersions()
      .then(setVersions)
      .catch(() => showToast("목록 로드 실패", false))
      .finally(() => setLoading(false));
  }, []);

  const handleRestore = async (v: PaperVersion) => {
    if (!confirm(`이 버전을 복원하시겠습니까?\n(${new Date(v.created_at).toLocaleString("ko-KR")})`)) return;
    try {
      const result = await restoreVersion(v.id);
      localStorage.setItem("restored_content", JSON.stringify(result.content ?? result));
      showToast("복원되었습니다. 연구 페이지로 이동합니다.");
      setTimeout(() => router.push("/research"), 1000);
    } catch {
      showToast("복원 실패", false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.ok ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← 대시보드
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">버전 기록</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <span className="mb-3 text-4xl">📝</span>
            <p className="font-semibold text-slate-600">저장된 버전이 없습니다</p>
            <p className="mt-1 text-sm text-slate-400">연구 노트를 작성하면 자동으로 저장됩니다.</p>
            <Link
              href="/research"
              className="mt-5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              연구 노트 작성하러 가기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="mb-4 text-sm text-slate-500">총 {versions.length}개의 버전</p>
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        v.save_type === "manual"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {v.save_type === "manual" ? "수동 저장" : "자동 저장"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(v.created_at).toLocaleString("ko-KR")}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(v)}
                  className="shrink-0 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  복원
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
