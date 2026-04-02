import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "논문집필 도우미",
  description: "Research Writing Assistant for Korean academics",
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
      <body className="min-h-full flex flex-col bg-[--background] text-[--foreground]">
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
