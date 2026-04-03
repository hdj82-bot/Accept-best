"use client";

import useSWR, { type SWRConfiguration } from "swr";
import {
  getMe,
  getNotes,
  getSearchHistory,
  type User,
  type ResearchNote,
  type SearchHistoryItem,
} from "./api";

// ── SWR defaults ────────────────────────────────────────────────────────────

const STALE_1M: SWRConfiguration = {
  dedupingInterval: 60_000,        // 1분간 중복 요청 방지
  revalidateOnFocus: false,
};

const STALE_5M: SWRConfiguration = {
  dedupingInterval: 300_000,       // 5분간 중복 요청 방지
  revalidateOnFocus: false,
};

// ── Hooks ───────────────────────────────────────────────────────────────────

/** 현재 로그인 사용자 정보 (1분 dedup). */
export function useUser() {
  return useSWR<User>("user:me", () => getMe(), STALE_1M);
}

/** 연구 노트 목록 (1분 dedup). */
export function useNotes() {
  return useSWR<ResearchNote[]>("notes:list", () => getNotes(), STALE_1M);
}

/** 최근 검색 기록 (5분 dedup). */
export function useSearchHistory() {
  return useSWR<SearchHistoryItem[]>(
    "search:history",
    () => getSearchHistory(),
    STALE_5M,
  );
}
