import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Cache Components: a static shell is prerendered, request data streams in behind <Suspense>,
  // and cached data ("use cache") is tagged so it can be invalidated precisely.
  cacheComponents: true,
  // Links prefetch each route's static shell once and reuse it, so navigation paints instantly.
  partialPrefetching: true,
  // Lets a second local dev server run side by side (NEXT_DIST_DIR=.next-alt). Unset in production.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default withWorkflow(nextConfig);
