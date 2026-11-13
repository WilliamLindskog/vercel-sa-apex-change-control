import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a second local dev server run side by side (NEXT_DIST_DIR=.next-alt). Unset in production.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default withWorkflow(nextConfig);
