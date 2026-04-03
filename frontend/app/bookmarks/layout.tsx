import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "북마크",
  description: "북마크한 논문을 모아보고 관리하세요.",
};

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
