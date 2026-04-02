import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginButton from "@/components/LoginButton";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            로그인
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            논문집필 도우미를 시작하려면 로그인하세요
          </p>
        </div>
        <LoginButton />
        <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
          로그인 시 서비스 이용약관 및 개인정보처리방침에
          <br />
          동의하는 것으로 간주합니다.
        </p>
      </div>
    </div>
  );
}
