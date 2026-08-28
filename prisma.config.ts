import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moved the connection URL out of schema.prisma. The schema now
 * declares only the provider; the URL lives here for the migrate and
 * introspect commands, and reaches PrismaClient separately through a driver
 * adapter (see src/lib/db.ts).
 *
 * Prisma 7 also stopped reading .env on its own, so load it here. Node's
 * built-in loader is used rather than the dotenv package: it is one less
 * dependency, and this file only ever runs under the CLI, never in the bundle.
 * The guard matters because CI and the VPS supply DATABASE_URL through the
 * real environment and have no .env file to read.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // No .env — expected wherever the environment is already populated.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations, not runtime. The application connects as a non-owner role that
  // row-level security applies to; that role cannot run DDL, and the owner role
  // that can must never be what serves requests.
  datasource: {
    url: env("MIGRATE_DATABASE_URL"),
    // Scratch database Prisma replays migrations into when it needs to know
    // what they add up to. It gets dropped and rebuilt on every use, so it must
    // never point at anything real.
    shadowDatabaseUrl: env("SHADOW_DATABASE_URL"),
  },
});
