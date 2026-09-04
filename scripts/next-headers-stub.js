// `next/headers` only works inside a Next request. The check scripts run in
// plain Node and exercise the pure parts of a module that happens to import
// it — guestLocaleFrom() reads a string, not a request — so the import is
// stubbed rather than resolved.
//
// Calling it is the mistake this throws for: a check that reached headers()
// would be a check depending on a request that does not exist, and a silent
// undefined would let it look like it passed.
export function headers() {
  throw new Error("next/headers is not available in a check script");
}

export function cookies() {
  throw new Error("next/headers is not available in a check script");
}
