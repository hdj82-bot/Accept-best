"use client";

import useSWR, { type SWRConfiguration, type SWRResponse, mutate } from "swr";
import {
  getMe,
  getNotes,
  getSearchHistory,
  getUsage,
  getAdminStats,
  getAdminUsers,
  getPaymentHistory,
  getBookmarks,
  getCollections,
  getCurrentBilling,
  getPlans,
  type User,
  type ResearchNote,
  type SearchHistoryItem,
  type MonthlyUsage,
  type AdminStats,
  type AdminUser,
  type PaymentHistoryItem,
  type Bookmark,
  type Collection,
  type CurrentBilling,
  type BillingPlan,
} from "./api";

// ── SWR 기본 설정 ──────────────────────────────────────────────────────────

/** 자주 바뀌는 데이터: 1분 dedup */
const STALE_1M: SWRConfiguration = {
  dedupingInterval: 60_000,
  revalidateOnFocus: false,
};

/** 준-정적 데이터: 5분 dedup */
const STALE_5M: SWRConfiguration = {
  dedupingInterval: 300_000,
  revalidateOnFocus: false,
};

/** 거의 안 바뀌는 데이터: 30분 dedup */
const STALE_30M: SWRConfiguration = {
  dedupingInterval: 1_800_000,
  revalidateOnFocus: false,
};

// ── SWR 캐시 키 상수 ──────────────────────────────────────────────────────
export const CACHE_KEYS = {
  user: "user:me",
  usage: "user:usage",
  notes: "notes:list",
  searchHistory: "search:history",
  bookmarks: "bookmarks:list",
  collections: "collections:list",
  plans: "billing:plans",
  billingCurrent: "billing:current",
  paymentHistory: "payment:history",
  adminStats: "admin:stats",
  adminUsers: "admin:users",
} as const;

// ── 사용자 / 사용량 훅 ────────────────────────────────────────────────────

/** 현재 로그인 사용자 정보 (1분 dedup). */
export function useUser(): SWRResponse<User> {
  return useSWR<User>(CACHE_KEYS.user, () => getMe(), STALE_1M);
}

/** 월간 사용량 통계 (1분 dedup). */
export function useUsage(): SWRResponse<MonthlyUsage> {
  return useSWR<MonthlyUsage>(CACHE_KEYS.usage, () => getUsage(), STALE_1M);
}

/** 연구 노트 목록 (1분 dedup). */
export function useNotes(): SWRResponse<ResearchNote[]> {
  return useSWR<ResearchNote[]>(CACHE_KEYS.notes, () => getNotes(), STALE_1M);
}

/** 최근 검색 기록 (5분 dedup). */
export function useSearchHistory(): SWRResponse<SearchHistoryItem[]> {
  return useSWR<SearchHistoryItem[]>(
    CACHE_KEYS.searchHistory,
    () => getSearchHistory(),
    STALE_5M,
  );
}

// ── 북마크 / 컬렉션 훅 ────────────────────────────────────────────────────

/** 북마크 목록 (1분 dedup). */
export function useBookmarks(): SWRResponse<Bookmark[]> {
  return useSWR<Bookmark[]>(CACHE_KEYS.bookmarks, () => getBookmarks(), STALE_1M);
}

/** 컬렉션 목록 (5분 dedup). */
export function useCollections(): SWRResponse<Collection[]> {
  return useSWR<Collection[]>(
    CACHE_KEYS.collections,
    () => getCollections(),
    STALE_5M,
  );
}

// ── 결제 / 빌링 훅 ────────────────────────────────────────────────────────

/** 결제 내역 (1분 dedup). */
export function usePaymentHistory(): SWRResponse<PaymentHistoryItem[]> {
  return useSWR<PaymentHistoryItem[]>(
    CACHE_KEYS.paymentHistory,
    () => getPaymentHistory(),
    STALE_1M,
  );
}

/** 플랜 목록 (30분 dedup - 거의 안 바뀜). */
export function usePlans(): SWRResponse<BillingPlan[]> {
  return useSWR<BillingPlan[]>(CACHE_KEYS.plans, () => getPlans(), STALE_30M);
}

/** 현재 구독 정보 (1분 dedup). */
export function useCurrentBilling(): SWRResponse<CurrentBilling> {
  return useSWR<CurrentBilling>(
    CACHE_KEYS.billingCurrent,
    () => getCurrentBilling(),
    STALE_1M,
  );
}

// ── 관리자 훅 ─────────────────────────────────────────────────────────────

/** 관리자 통계 (1분 dedup). */
export function useAdminStats(): SWRResponse<AdminStats> {
  return useSWR<AdminStats>(
    CACHE_KEYS.adminStats,
    () => getAdminStats(),
    STALE_1M,
  );
}

/** 관리자 유저 목록 (1분 dedup). */
export function useAdminUsers(): SWRResponse<AdminUser[]> {
  return useSWR<AdminUser[]>(
    CACHE_KEYS.adminUsers,
    () => getAdminUsers(),
    STALE_1M,
  );
}

// ── 수동 재검증 헬퍼 ──────────────────────────────────────────────────────

/** 특정 키의 캐시를 무효화하여 재요청을 유도. */
export function invalidate(key: keyof typeof CACHE_KEYS | string) {
  const cacheKey =
    typeof key === "string" && key in CACHE_KEYS
      ? CACHE_KEYS[key as keyof typeof CACHE_KEYS]
      : key;
  return mutate(cacheKey);
}

/** 여러 키를 한 번에 무효화. */
export function invalidateMany(keys: Array<keyof typeof CACHE_KEYS | string>) {
  return Promise.all(keys.map(invalidate));
}
