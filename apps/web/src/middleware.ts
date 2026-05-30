import { NextRequest, NextResponse } from "next/server";
import { authkit, applyResponseHeaders, partitionAuthkitHeaders } from "@workos-inc/authkit-nextjs";

// Derive the canonical hostname from WEB_URL (e.g. "https://app.example.com" → "app.example.com")
const WEB_URL = process.env.WEB_URL ?? "";
const MAIN_DOMAIN = WEB_URL ? new URL(WEB_URL).hostname : "";

// Internal hostnames that are never custom domains
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function hostname(host: string): string {
  // Strip port — "example.com:3000" → "example.com"
  return host.includes(":") ? host.split(":")[0] : host;
}

export async function middleware(request: NextRequest) {
  const authkitResult = await authkit(request, { debug: false });
  const { requestHeaders, responseHeaders } = partitionAuthkitHeaders(
    request,
    authkitResult.headers,
  );

  const host = request.headers.get("host") ?? "";
  const name = hostname(host);

  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  if (MAIN_DOMAIN && name !== hostname(MAIN_DOMAIN) && !LOOPBACK_HOSTS.has(name)) {
    // Custom domain: inject header so server components can read it
    requestHeaders.set("x-custom-host", name);
  }

  return applyResponseHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    responseHeaders,
  );
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
