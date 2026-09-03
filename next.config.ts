import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * ⚠ SO A VERIFICATION BUILD CANNOT CLOBBER A RUNNING DEV SERVER.
   *
   * `next dev` and `next build` both write to `.next` by default, and running a
   * build while the dev server is up corrupts what the browser is served. It
   * does not error: the page simply keeps showing stale code, which is a very
   * expensive thing to debug because every symptom points at your own logic.
   *
   * Verify with `DIST_DIR=.next-verify npm run build` and leave the dev server
   * alone. NEVER set DIST_DIR in a deploy environment.
   */
  distDir: process.env.DIST_DIR || '.next',
  
  // Capacitor export configuration - enables static export for mobile app
  output: process.env.CAP_BUILD === '1' ? 'export' : undefined,
  
  /* config options here */
};

export default nextConfig;
