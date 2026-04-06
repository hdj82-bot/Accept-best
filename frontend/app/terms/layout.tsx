import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "논문집필 도우미 서비스 이용약관",
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
