import { handleAuth } from "@workos-inc/authkit-nextjs";

// WorkOS AuthKit OAuth callback handler.
//
// Why this is on the WEB side (apps/web), not the API (apps/api):
// The OAuth flow uses PKCE — getSignInUrl() generates a code_verifier
// and seals it into the 'wos-auth-verifier' cookie. The callback handler
// MUST be able to read + unseal that cookie to complete the code exchange.
// @workos-inc/authkit-nextjs's handleAuth() does this transparently.
//
// We could have done the equivalent in NestJS by replicating the SDK's
// cookie sealing/unsealing logic, but that's brittle. handleAuth() owns
// the entire OAuth lifecycle:
//   - reads wos-auth-verifier-* cookie
//   - calls workos.userManagement.authenticateWithCode({ code, codeVerifier })
//   - seals the auth response into the wos-session cookie
//   - clears the wos-auth-verifier-* cookie
//   - redirects to the returnTo path
//
// After this writes wos-session, the NestJS SessionMiddleware
// (apps/api/src/auth/session.middleware.ts) reads it via loadSealedSession()
// using the SAME WORKOS_COOKIE_PASSWORD. Cookie format and encryption are
// interoperable between the SDK web side and the SDK Node side.
//
// Caddy routing note: /auth/callback (no /api/ prefix) routes to the
// Next.js server (port 3000), NOT the NestJS API (port 3001). The WorkOS
// dashboard Redirect URI must match exactly: https://portal.pexlo.com/auth/callback
export const GET = handleAuth();
