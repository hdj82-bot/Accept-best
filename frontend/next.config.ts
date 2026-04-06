import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["@sentry/nextjs", "swr"],
  },
  /**
   * Bundle analyzer: `ANALYZE=true npm run build` 로 번들 구성을 시각화.
   * @next/bundle-analyzer 설치 후 아래 주석 해제:
   *
   * const withBundleAnalyzer = require('@next/bundle-analyzer')({
   *   enabled: process.env.ANALYZE === 'true',
   * });
   * export default withBundleAnalyzer(withSentryConfig(nextConfig, { ... }));
   */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
});
