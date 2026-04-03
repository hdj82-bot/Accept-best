import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "설문문항 생성",
  description: "논문 기반 설문문항을 AI가 자동 생성 — 연구 설계를 효율적으로 지원합니다.",
};

export default function SurveyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
