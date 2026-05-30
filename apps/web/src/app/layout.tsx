import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { Providers } from "./providers";
// @ts-expect-error — raw string import via webpack asset/source
import changelogRaw from "../../CHANGELOG.md";
import "./globals.css";

function latestChangelogVersion(): string {
  const match = (changelogRaw as string).match(/^## \[(.+?)\]/m);
  return match?.[1] ?? "0.0.0";
}

export const metadata: Metadata = {
  title: {
    default: "Pexlo Portal",
    template: "%s · Pexlo Portal",
  },
  description: "Pexlo client portal — projects, deliverables, billing, and documents in one place.",
  applicationName: "Pexlo Portal",
  authors: [{ name: "Pexlo" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Pexlo Portal",
    siteName: "Pexlo Portal",
    description: "Pexlo client portal — projects, deliverables, billing, and documents in one place.",
    type: "website",
  },
};

const ALLOWED_TRACKER_KEYS = new Set([
  "src",
  "strategy",
  "async",
  "defer",
  "crossOrigin",
  "nonce",
  "type",
]);

function getTrackers(): Array<Record<string, string>> {
  const raw = process.env.NEXT_PUBLIC_TRACKERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is Record<string, string> => t && typeof t === "object" && typeof t.src === "string")
      .map((t) => {
        const safe: Record<string, string> = {};
        for (const [k, v] of Object.entries(t)) {
          if (ALLOWED_TRACKER_KEYS.has(k) || k.startsWith("data-")) {
            safe[k] = String(v);
          }
        }
        return safe;
      })
      .filter((t) => t.src);
  } catch {
    return [];
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const trackers = getTrackers();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {trackers.map((tracker, i) => (
          <Script
            key={tracker.src || i}
            defer
            strategy="afterInteractive"
            {...tracker}
          />
        ))}
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Link
          href="/changelog"
          className="fixed bottom-3 right-3 text-[10px] font-mono text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors opacity-50 hover:opacity-100"
        >
          v{latestChangelogVersion()}
        </Link>
      </body>
    </html>
  );
}
