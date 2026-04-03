import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "플랜 · 결제",
  description: "무료, Basic, Pro 플랜 비교 및 업그레이드 — 연구 생산성을 높이세요.",
};

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
