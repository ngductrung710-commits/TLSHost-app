import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundles the check scripts build from src/. Linting generated output
    // reports unused exports that are unused only because a bundler inlined
    // the module — a warning about code nobody wrote.
    ".tmp/**",
  ]),
]);

export default eslintConfig;
