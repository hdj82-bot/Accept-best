"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import React from "react";

import ko from "@/locales/ko.json";
import en from "@/locales/en.json";

// ── Types ──────────────────────────────────────────────────────────────────

export type Locale = "ko" | "en";

export const LOCALES: Locale[] = ["ko", "en"];
export const DEFAULT_LOCALE: Locale = "ko";
const STORAGE_KEY = "academi:locale";

type Messages = typeof ko;

const MESSAGES: Record<Locale, Messages> = { ko, en };

// ── Deep key path helper ───────────────────────────────────────────────────

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type TranslationKey = NestedKeyOf<Messages>;

// ── Context ────────────────────────────────────────────────────────────────

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // 마운트 시 localStorage 에서 복원
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && LOCALES.includes(stored)) {
        setLocaleState(stored);
      }
    } catch {
      /* SSR / private mode */
    }
  }, []);

  // locale 변경 시 <html lang> 업데이트 + localStorage 저장
  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* quota exceeded / private mode */
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    if (LOCALES.includes(l)) setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string>): string => {
      const msgs = MESSAGES[locale];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = msgs;
      for (const part of key.split(".")) {
        value = value?.[part];
        if (value === undefined) return key; // fallback to key
      }
      if (typeof value !== "string") return key;
      if (!vars) return value;
      return value.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
    },
    [locale],
  );

  const ctx = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return React.createElement(I18nContext.Provider, { value: ctx }, children);
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/**
 * i18n 컨텍스트 훅.
 * Provider 밖에서도 안전하게 동작 (ko fallback).
 */
export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Provider 밖 fallback
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => undefined,
    t: (key: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = ko;
      for (const part of key.split(".")) {
        value = value?.[part];
        if (value === undefined) return key;
      }
      return typeof value === "string" ? value : key;
    },
  };
}

/**
 * 현재 locale에 맞는 날짜 포맷.
 */
export function formatDate(date: string | Date, locale: Locale = DEFAULT_LOCALE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US");
}

/**
 * 현재 locale에 맞는 숫자 포맷.
 */
export function formatNumber(n: number, locale: Locale = DEFAULT_LOCALE): string {
  return n.toLocaleString(locale === "ko" ? "ko-KR" : "en-US");
}
