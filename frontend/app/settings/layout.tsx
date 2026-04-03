import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "계정 설정",
  description: "프로필 수정, 구독 관리, 계정 설정을 관리하세요.",
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
