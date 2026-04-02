"use client";

import { useState } from "react";
import { addBookmark, removeBookmark } from "@/lib/api";

interface BookmarkButtonProps {
  paperId: string;
  isBookmarked: boolean;
  /** Called after the bookmark state changes successfully */
  onChange?: (newState: boolean) => void;
  size?: "sm" | "md";
}

/**
 * Heart / bookmark toggle button with optimistic update.
 * Rolls back on API failure.
 *
 * Props:
 *   paperId       — paper to bookmark / un-bookmark
 *   isBookmarked  — current state (controlled)
 *   onChange      — notified with new state after toggle
 *   size          — "sm" (16px) | "md" (20px, default)
 */
export default function BookmarkButton({
  paperId,
  isBookmarked,
  onChange,
  size = "md",
}: BookmarkButtonProps) {
  const [optimistic, setOptimistic] = useState(isBookmarked);
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // don't trigger parent card click
    if (loading) return;

    const next = !optimistic;
    setOptimistic(next);   // optimistic update
    setLoading(true);

    try {
      if (next) {
        await addBookmark(paperId);
      } else {
        await removeBookmark(paperId);
      }
      onChange?.(next);
    } catch {
      setOptimistic(!next); // rollback
    } finally {
      setLoading(false);
    }
  };

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label={optimistic ? "북마크 해제" : "북마크"}
      title={optimistic ? "북마크 해제" : "북마크"}
      className={`rounded-full p-1.5 transition-colors disabled:cursor-not-allowed ${
        optimistic
          ? "text-rose-500 hover:bg-rose-50"
          : "text-slate-400 hover:bg-slate-100 hover:text-rose-400"
      } ${loading ? "opacity-50" : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={iconSize}
        fill={optimistic ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
