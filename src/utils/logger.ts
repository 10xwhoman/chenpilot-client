/**
 * Shared logger (#133) — the only entry point for runtime logging.
 *
 * - Silent in production (NODE_ENV !== 'development')
 * - Routes error paths through console.error (so devs still see real failures)
 * - rate-limited in development to avoid spamming the console
 */

const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

// Rate limit: at most one identical message per 2 seconds in dev
const recentMessages = new Map<string, number>();
const RATE_LIMIT_MS = 2_000;

function rateLimited(key: string): boolean {
  if (!isDev) return true; // never log in production
  const now = Date.now();
  const last = recentMessages.get(key) ?? 0;
  if (now - last < RATE_LIMIT_MS) return true;
  recentMessages.set(key, now);
  return false;
}

function format(args: unknown[]): string {
  return args
    .map((a) => (typeof a === "string" ? a : (() => {
      try { return JSON.stringify(a); } catch { return String(a); }
    })()))
    .join(" ");
}

export const logger = {
  info(...args: unknown[]): void {
    if (rateLimited(format(args))) return;
    // eslint-disable-next-line no-console
    console.log("[info]", ...args);
  },
  warn(...args: unknown[]): void {
    if (rateLimited(format(args))) return;
    // eslint-disable-next-line no-console
    console.warn("[warn]", ...args);
  },
  error(...args: unknown[]): void {
    // errors are never rate-limited — they signal real failures
    // eslint-disable-next-line no-console
    console.error("[error]", ...args);
  },
  debug(...args: unknown[]): void {
    if (!isDev) return; // debug only in dev/test
    if (rateLimited(format(args))) return;
    // eslint-disable-next-line no-console
    console.log("[debug]", ...args);
  },
};

export default logger;
