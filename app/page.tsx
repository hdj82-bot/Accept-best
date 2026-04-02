import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginButton from "@/components/LoginButton";

export default async function Home() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-8 py-32 px-8">
        <h1 className="text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
          논문집필 도우미
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 text-center max-w-md">
          한국 대학교 교수·박사과정 연구자를 위한
          <br />
          AI 기반 논문집필 지원 서비스
        </p>
        <div className="flex gap-4">
          <LoginButton />
        </div>
      </main>
    </div>
  );
}
