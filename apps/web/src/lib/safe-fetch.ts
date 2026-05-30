/**
 * Helpers for server-side fetches from the web app to the NestJS API.
 *
 * Why these exist: the NestJS API returns JavaScript `null` for many
 * "absent" cases (no session, no branding, no active org, etc.). Nest
 * serializes JS `null` as HTTP 200 with `content-length: 0` (empty body),
 * NOT the literal string `"null"`. Calling res.json() on an empty body
 * throws `SyntaxError: Unexpected EOF`. Even with try/catch, this surfaces
 * to Next.js's React Server Component error boundary and renders a 500.
 *
 * safeJson() reads the body as text first and returns null on empty,
 * making "200 + empty body" a first-class case instead of a thrown error.
 */
export async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
