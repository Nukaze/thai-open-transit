// apps/web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  agentRules: false,
  trailingSlash: true,
  // Every screen corner is taken by map UI (panel or credits, theme button,
  // controls), so the dev-only "N" badge always lands on something - it sat
  // on the credits and made them look blocked. Build and runtime errors
  // still surface with it off (Next.js devIndicators docs).
  devIndicators: false,
};

export default nextConfig;
