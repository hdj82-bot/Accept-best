import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "버전 기록",
  description: "연구 노트의 자동·수동 저장 버전을 관리하고 이전 버전으로 복원하세요.",
};

export default function VersionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
