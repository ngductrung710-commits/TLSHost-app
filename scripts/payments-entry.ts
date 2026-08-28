// Bundling entry for `npm run check:payments`. The check runs the real
// modules, not copies of them — a rewritten currency table that only lives in
// a test proves nothing about what a guest is charged.
export { __testing } from "@/lib/payments";
export {
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsConfigured,
} from "@/lib/secrets";
