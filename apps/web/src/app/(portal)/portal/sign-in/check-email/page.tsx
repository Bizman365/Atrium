import Link from "next/link";
import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-pexlo-serif",
  display: "swap",
});

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; callbackUrl?: string }>;
}) {
  const { email, callbackUrl } = await searchParams;

  return (
    <main className={`${sourceSerif.variable} min-h-screen bg-pexlo-paper px-6 py-10 text-pexlo-ink`}>
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center">
        <section className="border-y border-pexlo-hairline py-10">
          <p className="text-sm font-black tracking-[-0.04em] text-pexlo-terracotta">PEXLO</p>
          <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-pexlo-ink-soft">Magic link sent</p>
          <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Check your email.</h1>
          <p className="mt-6 text-lg leading-8 text-pexlo-ink-soft">
            We sent a secure sign-in link{email ? ` to ${email}` : ""}. Open it on this device to continue to your Pexlo project status view.
          </p>
          <Link
            href={`/portal/sign-in${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
            className="mt-8 inline-flex text-sm font-semibold uppercase tracking-[0.18em] text-pexlo-terracotta-deep hover:underline"
          >
            Use a different email
          </Link>
        </section>
      </div>
    </main>
  );
}
