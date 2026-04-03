import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "대시보드",
  description: "연구 노트, 검색 기록, 사용량을 한눈에 확인하세요.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
