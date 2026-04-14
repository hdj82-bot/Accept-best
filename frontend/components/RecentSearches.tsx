"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "podwrite_recent_searches";
const MAX_ITEMS = 5;

export interface RecentSearch {
  keyword: string;
  timestamp: number;
}

export function saveRecentSearch(keyword: string) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items: RecentSearch[] = raw ? JSON.parse(raw) : [];
    const filtered = items.filter((s) => s.keyword !== keyword);
    filtered.unshift({ keyword, timestamp: Date.now() });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(filtered.slice(0, MAX_ITEMS)),
    );
  } catch {
    // localStorage unavailable
  }
}

export default function RecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSearches(JSON.parse(raw));
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (searches.length === 0) return null;

  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        최근 검색
      </h3>
      <div className="flex flex-wrap gap-2">
        {searches.map((s) => (
          <Link
            key={s.keyword}
            href={`/papers?q=${encodeURIComponent(s.keyword)}`}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
          >
            {s.keyword}
          </Link>
        ))}
      </div>
    </section>
  );
}
