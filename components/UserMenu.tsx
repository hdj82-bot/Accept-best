"use client";

import { signOut, useSession } from "next-auth/react";

export default function UserMenu() {
  const { data: session } = useSession();

  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {session.user.email}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        로그아웃
      </button>
    </div>
  );
}
