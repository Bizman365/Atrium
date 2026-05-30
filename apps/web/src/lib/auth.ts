import { cookies } from "next/headers";

export async function getSession() {
  try {
    const cookieStore = await cookies();
    const res = await fetch(
      `${process.env.API_URL || "http://localhost:3001"}/api/auth/get-session`,
      {
        headers: { Cookie: cookieStore.toString() },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;

    // The NestJS auth.controller.ts get-session endpoint returns `null` for
    // unauthenticated requests, which Nest serializes as a HTTP 200 with
    // content-length: 0 (empty body). res.json() on an empty body throws
    // SyntaxError: Unexpected EOF, which crashes the calling Server Component.
    // Read as text first so we can distinguish empty vs JSON-null vs object.
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
