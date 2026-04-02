import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";
import GlobalNav from "@/components/GlobalNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://academi.ai"
  ),
  title: {
    default: "논문집필 도우미",
    template: "%s | 논문집필 도우미",
  },
  description: "AI 기반 논문 수집, 설문 생성, 버전 관리 — 한국 연구자를 위한 연구 작성 도우미",
  openGraph: {
    siteName: "논문집필 도우미",
    type: "website",
  },
};

/**
 * Inline script injected into <head> to prevent theme flash (FOUC).
 * Runs before any CSS or React hydration — reads localStorage and
 * sets the `dark` class on <html> immediately.
 */
const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Theme init — must run before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      {/* PortOne (아임포트) SDK — loaded after page is interactive */}
      <Script
        src="https://cdn.iamport.kr/v1/iamport.js"
        strategy="lazyOnload"
      />
      <body className="min-h-full flex flex-col bg-[--background] text-[--foreground] pb-20 lg:pb-0">
        <SessionProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <GlobalNav />
        </SessionProvider>
      </body>
    </html>
  );
}
