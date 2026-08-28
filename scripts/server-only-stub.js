// `server-only` is a build-time guard: importing it from a client bundle is a
// Next-specific error. These check scripts run in plain Node, where there is no
// client bundle and the guard has nothing to say, so it is stubbed out rather
// than bundled.
export {};
