import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "참고문헌 관리",
  description: "참고문헌 추가, 편집, BibTeX 내보내기 — 체계적인 문헌 관리를 지원합니다.",
};

export default function RefsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
