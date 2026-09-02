import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Ship a server that carries only what it imports.
   *
   * Without this, running the app on a server means keeping the whole
   * node_modules beside it — 782 MB, most of which is build-time tooling that
   * never runs in production. Standalone traces the actual import graph and
   * writes a folder with a server.js and the pruned dependencies, which for
   * this app is around 17 MB of application output.
   *
   * The trade is that two directories are NOT copied in for you, and nothing
   * warns when they are missing: `.next/static` and `public/`. A server
   * started without them boots, serves HTML, and returns 404 for every
   * stylesheet, script and image — a page that looks broken rather than one
   * that fails. See DEPLOY.md, which does the copying explicitly.
   */
  output: "standalone",

  /**
   * Drag @prisma/adapter-pg into the standalone output.
   *
   * Next traces what the *application* imports, and the application's copy of
   * this package ends up inlined into the server chunks — so the site runs
   * without it on disk. The hourly sync worker is a separate process that
   * imports it by name at runtime, and on a server carrying only the
   * standalone folder it would fail to resolve, once an hour, in a cron job
   * nobody is watching.
   *
   * Found by copying the standalone folder *outside* the repository and
   * resolving from there. Resolving from `.next/standalone` in place succeeds
   * whatever is missing, because Node walks up into the repo's own
   * node_modules — a test that can only ever pass.
   */
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@prisma/adapter-pg/**/*"],
  },
};

export default nextConfig;
