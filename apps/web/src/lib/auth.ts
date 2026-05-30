import { cookies } from "next/headers";
import { safeJson } from "./safe-fetch";

export interface Session {
  user?: { id?: string; email?: string; name?: string; emailVerified?: boolean };
  session?: { id?: string; userId?: string; activeOrganizationId?: string | null };
  organization?: { id?: string; name?: string; slug?: string | null } | null;
  member?: { id?: string; userId?: string; organizationId?: string; role?: string } | null;
}

export async function getSession(): Promise<Session | null> {
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
    return await safeJson<Session>(res);
  } catch {
    return null;
  }
}
