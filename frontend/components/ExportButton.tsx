"use client";

import { useEffect, useRef, useState } from "react";
import {
  exportNote,
  getExportStatus,
  type ExportFormat,
} from "@/lib/api";

interface ExportButtonProps {
  noteId: string;
}

const MAX_POLLS = 30;
const POLL_INTERVAL_MS = 1_000;

type ExportState =
  | { status: "idle" }
  | { status: "exporting"; format: ExportFormat; polls: number }
  | { status: "error"; message: string };

/**
 * Dropdown export button.
 * Triggers async export, polls for completion, then auto-downloads.
 *
 * Props:
 *   noteId — ID of the note to export
 */
export default function ExportButton({ noteId }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ExportState>({ status: "idle" });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startExport = async (format: ExportFormat) => {
    setOpen(false);
    setState({ status: "exporting", format, polls: 0 });

    let taskId: string;
    try {
      const res = await exportNote(format, noteId);
      taskId = res.task_id;
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "내보내기 시작 실패",
      });
      return;
    }

    let pollCount = 0;
    pollRef.current = setInterval(async () => {
      pollCount += 1;
      setState({ status: "exporting", format, polls: pollCount });

      if (pollCount >= MAX_POLLS) {
        clearInterval(pollRef.current!);
        setState({ status: "error", message: "내보내기 시간 초과 (30초)" });
        return;
      }

      try {
        const statusRes = await getExportStatus(taskId);

        if (statusRes.status === "SUCCESS" && statusRes.download_url) {
          clearInterval(pollRef.current!);
          triggerDownload(
            statusRes.download_url,
            `note_${noteId}.${format === "pdf" ? "pdf" : "md"}`,
          );
          setState({ status: "idle" });
        } else if (statusRes.status === "FAILURE") {
          clearInterval(pollRef.current!);
          setState({
            status: "error",
            message: statusRes.error ?? "내보내기 실패",
          });
        }
        // PENDING / PROCESSING → keep polling
      } catch {
        // transient network error — continue polling
      }
    }, POLL_INTERVAL_MS);
  };

  const isExporting = state.status === "exporting";

  return (
    <div ref={dropdownRef} className="relative">
      {/* Main button */}
      <button
        onClick={() => {
          if (isExporting) return;
          if (state.status === "error") { setState({ status: "idle" }); return; }
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
          isExporting
            ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
            : state.status === "error"
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-slate-200 text-slate-600 hover:bg-slate-100"
        }`}
        title={state.status === "error" ? state.message : "내보내기"}
      >
        {isExporting ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            내보내는 중…
          </>
        ) : state.status === "error" ? (
          <>⚠ 재시도</>
        ) : (
          <>↓ 내보내기</>
        )}
      </button>

      {/* Dropdown */}
      {open && !isExporting && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {(
            [
              { format: "markdown" as ExportFormat, label: "Markdown (.md)", icon: "📝" },
              { format: "pdf"      as ExportFormat, label: "PDF (.pdf)",     icon: "📄" },
            ] as const
          ).map(({ format, label, icon }) => (
            <button
              key={format}
              onClick={() => startExport(format)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
