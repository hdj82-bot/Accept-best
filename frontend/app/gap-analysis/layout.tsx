import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "연구 공백 발견",
  description: "AI가 기존 문헌을 분석하여 연구 공백과 새로운 연구 기회를 발견합니다.",
};

export default function GapAnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
