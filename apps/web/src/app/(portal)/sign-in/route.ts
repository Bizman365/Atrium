import { NextResponse, type NextRequest } from "next/server";

// Convenience redirect from /sign-in → /portal/sign-in (the canonical AuthKit
// entry route handler that initiates the WorkOS sign-in flow). Preserves the
// callbackUrl query param so the post-auth landing target is honored.
export function GET(request: NextRequest) {
  const url = new URL("/portal/sign-in", request.url);
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  if (callbackUrl) url.searchParams.set("callbackUrl", callbackUrl);
  return NextResponse.redirect(url);
}
