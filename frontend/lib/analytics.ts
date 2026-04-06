/**
 * Google Analytics 4 helper.
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics";
 *   trackEvent("search", { query: "transformer" });
 *
 * Set NEXT_PUBLIC_GA_MEASUREMENT_ID in .env to enable.
 * When the env var is empty, all calls are no-ops.
 */

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

/** Whether GA is configured for this deployment. */
export const isGAEnabled = GA_MEASUREMENT_ID.length > 0;

/* ---------- page view ---------- */

export function trackPageView(url: string) {
  if (!isGAEnabled) return;
  window.gtag?.("config", GA_MEASUREMENT_ID, { page_path: url });
}

/* ---------- custom events ---------- */

export function trackEvent(
  action: string,
  params?: Record<string, string | number | boolean>,
) {
  if (!isGAEnabled) return;
  window.gtag?.("event", action, params);
}

/* ---------- type augmentation ---------- */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
