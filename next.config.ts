import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Packages that use native binaries / child_process and should not be
  // bundled by the Next.js server compiler.  This prevents Vercel from
  // attempting to bundle playwright's large chromium binary or python
  // subprocess helpers into the serverless function, which would exceed
  // size limits and/or fail at runtime.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
