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
    return res.json();
  } catch {
    return null;
  }
}
