import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

export default withSentryConfig(nextConfig, {
  // Suppress source-map upload warnings in dev
  silent: true,
  // Disable Sentry telemetry
  telemetry: false,
});
