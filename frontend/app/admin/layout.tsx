import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "관리자 대시보드",
  description: "사용자 관리, 통계, 사용량 모니터링 — 관리자 전용 대시보드입니다.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
