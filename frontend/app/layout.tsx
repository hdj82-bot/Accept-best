import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { SessionProvider } from "next-auth/react";
import GlobalNav from "@/components/GlobalNav";
import ErrorBoundary from "@/components/ErrorBoundary";
import SkipLink from "@/components/SkipLink";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/lib/i18n";
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
/**
 * Inline script: prevent theme FOUC + restore saved locale on <html lang>.
 */
const initScript = `
(function(){
  try {
    var t = localStorage.getItem('theme');
    var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    var l = localStorage.getItem('academi:locale');
    if (l === 'en') document.documentElement.lang = 'en';
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
        {/* Theme + locale init — must run before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
      </head>
      {/* PortOne (아임포트) SDK — loaded after page is interactive */}
      <Script
        src="https://cdn.iamport.kr/v1/iamport.js"
        strategy="lazyOnload"
      />
      <body className="min-h-full flex flex-col bg-[--background] text-[--foreground] pb-20 lg:pb-0">
        <SkipLink />
        <SessionProvider>
          <I18nProvider>
            <ToastProvider>
              <ErrorBoundary scope="root">
                <div id="main-content" tabIndex={-1} className="flex-1 outline-none">
                  {children}
                </div>
              </ErrorBoundary>
              <GlobalNav />
            </ToastProvider>
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
