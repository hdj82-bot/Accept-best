import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "연구 노트",
  description: "AI 기반 논문 검색과 연구 노트 작성 — 키워드로 논문을 수집하고 체계적으로 정리하세요.",
};

export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
