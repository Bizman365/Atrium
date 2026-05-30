import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";

export const metadata: Metadata = {
  title: "Client sign in",
  robots: { index: false, follow: false },
};

function safeCallback(raw?: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/portal";
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  redirect(await getSignInUrl({ returnTo: safeCallback(callbackUrl) }));
}
