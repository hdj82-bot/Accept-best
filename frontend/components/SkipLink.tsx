"use client";

/**
 * 키보드 사용자를 위한 "본문 바로가기" 링크.
 * 평소엔 화면 밖(sr-only)에 있다가 포커스되면 좌상단에 나타남.
 */
export default function SkipLink({
  targetId = "main-content",
  label = "본문으로 바로가기",
}: {
  targetId?: string;
  label?: string;
}) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[200] focus-visible:rounded-lg focus-visible:bg-blue-600 focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white focus-visible:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {label}
    </a>
  );
}
