import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "논문 건강검진",
  description: "AI가 논문의 구조, 명료성, 독창성을 분석하고 개선 방향을 제시합니다.",
};

export default function CheckupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
