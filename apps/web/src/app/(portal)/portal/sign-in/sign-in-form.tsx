"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function safeCallback(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/portal";
  if (raw.startsWith("//")) return "/portal";
  return raw;
}

export function ClientPortalSignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => safeCallback(searchParams.get("callbackUrl")), [searchParams]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"magic" | "google" | null>(null);

  async function requestMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading("magic");

    try {
      const res = await fetch(`${API_URL}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, callbackURL: callbackUrl }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Could not send magic link");
      }

      router.push(`/portal/sign-in/check-email?email=${encodeURIComponent(email)}&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send magic link");
    } finally {
      setLoading(null);
    }
  }

  async function continueWithGoogle() {
    setError("");
    setLoading("google");

    try {
      const res = await fetch(`${API_URL}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider: "google",
          callbackURL: callbackUrl,
          errorCallbackURL: `/portal/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Google sign-in failed");
      if (body.url) {
        window.location.href = body.url;
      } else {
        window.location.href = callbackUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-pexlo-paper px-6 py-10 text-pexlo-ink">
      <main className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <p className="text-sm font-black tracking-[-0.04em] text-pexlo-terracotta">PEXLO</p>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-pexlo-ink-soft">
            Client access
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[0.98] tracking-[-0.04em] sm:text-6xl">
            Sign in to view your project status.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-pexlo-ink-soft">
            Use the email address Pexlo invited. Magic link and Google sign-in both keep this view tied to your organization membership.
          </p>
        </section>

        <section className="border-y border-pexlo-hairline py-8">
          {error ? <p className="mb-5 text-sm text-pexlo-accent">{error}</p> : null}
          <form onSubmit={requestMagicLink} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-pexlo-ink-soft">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-3 w-full border border-pexlo-hairline bg-transparent px-4 py-3 text-base outline-none transition focus:border-pexlo-terracotta"
                placeholder="you@company.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading !== null}
              className="w-full bg-pexlo-terracotta px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-pexlo-terracotta-deep disabled:opacity-60"
            >
              {loading === "magic" ? "Sending…" : "Send magic link"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-pexlo-ink-soft">
            <span className="h-px flex-1 bg-pexlo-hairline" />
            or
            <span className="h-px flex-1 bg-pexlo-hairline" />
          </div>

          <button
            type="button"
            onClick={continueWithGoogle}
            disabled={loading !== null}
            className="w-full border border-pexlo-hairline px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-pexlo-ink transition hover:border-pexlo-terracotta hover:text-pexlo-terracotta-deep disabled:opacity-60"
          >
            {loading === "google" ? "Redirecting…" : "Continue with Google"}
          </button>
        </section>
      </main>
    </div>
  );
}
