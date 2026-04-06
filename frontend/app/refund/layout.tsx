import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "환불정책",
  description: "전자상거래법에 따른 환불 및 청약철회 정책",
};

export default function RefundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
