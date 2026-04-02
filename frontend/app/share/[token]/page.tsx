import type { Metadata } from "next";
import { getOgMeta } from "@/lib/api";
import SharedNoteClient from "./SharedNoteClient";

// ────────────────────────────────────────────────────────────────────────────
// OG / SEO metadata (server-side, cached 1h)
// ────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  try {
    const og = await getOgMeta(token);
    return {
      title: og.title
        ? `${og.title} | 논문집필 도우미`
        : "공유된 연구 노트 | 논문집필 도우미",
      description: og.description ?? "논문집필 도우미에서 공유된 연구 노트입니다.",
      openGraph: {
        title: og.title ?? "공유된 연구 노트",
        description: og.description ?? "논문집필 도우미에서 공유된 연구 노트입니다.",
        type: "article",
        ...(og.owner_name ? { authors: [og.owner_name] } : {}),
      },
    };
  } catch {
    return {
      title: "공유된 연구 노트 | 논문집필 도우미",
      description: "논문집필 도우미에서 공유된 연구 노트입니다.",
    };
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Page — server wrapper renders the client component
// ────────────────────────────────────────────────────────────────────────────

export default async function SharedNotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedNoteClient token={token} />;
}
