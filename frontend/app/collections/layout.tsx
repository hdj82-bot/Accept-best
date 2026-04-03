import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "컬렉션 · 태그",
  description: "논문을 컬렉션과 태그로 체계적으로 분류하고 관리하세요.",
};

export default function CollectionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
