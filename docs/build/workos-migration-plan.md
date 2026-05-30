# WorkOS Auth Migration Plan (Pexlo Portal)

**Status:** Planned for Saturday May 30, 2026 (fresh-brain execution)
**Author:** Omni (May 29, 2026 evening prep)
**Reviewed by:** Chris (pending — read before kickoff)

## 1. What

Migrate Pexlo Portal from Better Auth (current) → WorkOS AuthKit as the canonical auth provider.

**Scope:**
- Auth UI: Better Auth's bare form → WorkOS AuthKit hosted page (or custom UI v2 later)
- Magic link emails: Better Auth → WorkOS-managed emails (templates configured in WorkOS dashboard)
- Session management: Better Auth cookies → WorkOS session pattern
- Organization model: Better Auth `organization` plugin → WorkOS Organizations

**Deferred to v2 (dashboard config only — zero code involvement when re-enabled):**
- Google OAuth (was Better Auth social provider) — config flip in WorkOS dashboard
- Custom AuthKit branding (logo, colors, app name) — dashboard
- Custom email templates + custom email domain — dashboard
- MFA, additional auth methods (Email+Password, GitHub, Microsoft, Apple) — dashboard

**NOT in scope:**
- Agent API keys (`api_key` table) — orthogonal, stays bearer-token-based as built in PXL-5
- Existing user data in `user`, `member`, `organization` Prisma tables — preserved as canonical
- Pexlo Agent user (`user-pexlo-agent`) — preserved; never touches WorkOS

## 2. Why

1. **Chris's chosen long-term standard** — explicitly committed May 29 evening: "we are using work OS"
2. **AuthKit UX > Better Auth bare form** — hosted page is Stripe-quality; Better Auth is roll-your-own
3. **SOC 2 Type II + audit logs** — Pexlo client trust signal, especially for R&D credit substantiation
4. **Enterprise SSO ready** — when CSP wants Microsoft 365 SSO, it's a config flip ($125/mo SAML add-on), not a rewrite
5. **Already paying for it** — `workos-pexlo-api-key` + `workos-pexlo-client-id` provisioned May 26
6. **One auth provider across Pexlo product family** — same pattern for Dwelbase, WPI, future clients

## 3. Considered & Rejected

### Kept Better Auth indefinitely
**Rejected.** Better Auth works but is "roll-your-own UI" — every polish hour is wasted when we're going to WorkOS anyway. May 29 magic link email looks like a placeholder. Chris will not ship that to clients committing $10k+.

### Use Clerk instead
**Rejected.** Free tier is generous (10K MAU) but Pexlo is already paying for WorkOS. Clerk also doesn't have WorkOS's enterprise SSO story.

### Custom WorkOS UI (Node SDK) tonight
**Rejected.** Custom UI = 2-3 hours of design work + risk on top of the migration. AuthKit hosted is 30 min faster + good-looking by default. We can move to custom UI in v2 if needed.

### Migrate at night (Friday May 29)
**Rejected.** After 3 deploy incidents + ~13 hours of work, auth migration with tired brain = invitation to incident #4. Saturday morning fresh brain = correct decision.

### Add `workosUserId` field to existing `User` model and keep `User` as canonical
**ACCEPTED** (default path). Avoids data migration on existing user table. WorkOS becomes the auth provider that authenticates against our `User` table identities, not the source of truth.

### Drop the `user` table and let WorkOS be the source of truth
**Rejected.** Comments + project_updates have `authorId` FK pointing at `user.id`. Pexlo Agent user is a row in `user`. Better Auth member/organization tables FK off `user`. Migrating to "WorkOS is source of truth" is a much bigger lift.

## 4. Pre-flight inventory (DONE May 29 evening by Omni)

### WorkOS account state — VERIFIED VIA API at 18:53 EDT

**Current state (mostly empty, needs setup):**
- API key works: `sk_test_a2V5XzA...` (test environment)
- Client ID: `client_01KSK8QWD5TZ66ZB54...`
- Organizations: 1 placeholder "Test Organization" (id: `org_01KSK8QW5SBC1W2WKVHN2Z67H5`) — NOT a real Pexlo/CSP org yet
- Users: 0
- Connections: 0 (no Google OAuth, no Magic Link configured)

**Done by Omni May 29 evening:**
- [x] WorkOS Pexlo project exists
- [x] API Key in Keychain: `workos-pexlo-api-key`
- [x] Client ID in Keychain: `workos-pexlo-client-id`
- [x] **Cookie Password generated + stored:** `workos-pexlo-cookie-password` (account: `chris@dwelbase.io`)
- [x] Existing Google OAuth credentials confirmed in Keychain: `pexlo-portal-google-oauth-client-id` + `pexlo-portal-google-oauth-client-secret` (account: `chris@dwelbase.io`) — can reuse these in WorkOS

**TODO before code migration (Chris's hands, ~2 min):**

### 4a. WorkOS dashboard — minimum to unblock code (~2 min)

Go to https://dashboard.workos.com and do ONLY these two things — everything else is dashboard config that can happen any time before, during, or after the code migration with zero code involvement:

1. **Add Redirect URIs** (Configuration → Redirects):
   - `https://portal.pexlo.com/api/auth/callback`
   - `http://localhost:3000/api/auth/callback`

2. **Enable Magic Auth** (Authentication → Methods → toggle ON Magic Auth):
   - At least one auth method must be enabled so a user can sign in

**That's it.** The redirect URIs and at least one auth method are the only dashboard items the WorkOS SDK callback needs to function. Everything below is deferrable.

### 4a-bis. Dashboard config that does NOT block code (do anytime)

These are all dashboard-only operations — no code changes, no deploys, no Crank involvement. Do them whenever, in whatever order:

- **AuthKit branding** (AuthKit → Branding): Logo upload (`~/.openclaw/workspace/pexlo-logo-light.png`), primary color `#C85A38`, app name `Pexlo Portal`, support email `chris@pexlo.com`
- **Email templates** (AuthKit → Emails): Magic-link email subject + body, sender name
- **Custom email domain** (AuthKit → Custom Domains): Add `portal.pexlo.com` or `mail.pexlo.com`, add the SPF/DKIM records to Cloudflare `pexlo.com` zone, wait 10–30 min for verification, set as default "from" domain
- **Additional auth methods** (Authentication → Methods): Email+Password, Google, GitHub, Microsoft, Apple — toggle on anytime
- **MFA** (Authentication → MFA): TOTP / SMS / recovery codes — toggle anytime
- **Rename Test Organization** → `Pexlo Internal` (or create new with `domain: pexlo.com`)
- **Create CSP organization** when Soyini onboards: `City Safe Partners`, domain `citysafepartners.com`

### Google OAuth — DEFERRED to v2
Google OAuth re-enable is a config flip in WorkOS dashboard (paste existing Google Cloud Console Client ID + Secret, set Google Cloud redirect URI to `https://api.workos.com/sso/oauth/google/callback`). Zero code involvement when we decide to turn it back on.

### 4b. Hetzner .env additions (Crank can do, 5 min)

Add to `/opt/pexlo-portal/.env`:
```
WORKOS_API_KEY=<from Keychain: workos-pexlo-api-key>
WORKOS_CLIENT_ID=<from Keychain: workos-pexlo-client-id>
WORKOS_COOKIE_PASSWORD=<from Keychain: workos-pexlo-cookie-password>
WORKOS_REDIRECT_URI=https://portal.pexlo.com/api/auth/callback
```

All three values are already in Keychain ready to copy.

### 4c. Safety nets (Crank, 10 min)

- [ ] Neon safety branch: `pre-workos-migration-2026-05-30`
- [ ] Git tag: `pre-workos-migration-2026-05-30`
- [ ] Hetzner Docker image tag: `pexlo-portal:pre-workos-migration-2026-05-30`

### Current Better Auth state (what we're replacing)
- `apps/api/src/auth/auth.service.ts` — main config (~400 lines)
- `apps/api/src/auth/session.middleware.ts` — cookie parsing
- `apps/web/src/app/(portal)/portal/sign-in/` — sign-in pages
- `apps/web/src/lib/auth.ts` — `getSession()` helper hitting `/api/auth/get-session`
- Env vars: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (post-migration: keep in `.env` for rollback safety; new env vars are `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_REDIRECT_URI`)
- Tables: `session`, `account`, `verification` — Better Auth managed

### Existing data to preserve
- `user` table: 77 rows including `chris@pexlo.com`, `user-pexlo-agent`, test users
- `organization` table: 71 rows (most are test cal-* / te-*; Pexlo org id `70483073F84A4BFBBFE35B04`)
- `member` table: org membership links
- `api_key` table: 2 rows (Omni + Crank agent bearer tokens — NOT affected by migration)

## 5. Threat model (READ THIS BEFORE STARTING)

| Step | Risk | Severity | Mitigation |
|---|---|---|---|
| Install WorkOS SDK + remove Better Auth | Bun lockfile conflicts, peer dep issues | Low | Test build locally before pushing |
| Refactor `auth.service.ts` | Sessions break, no one can sign in | High | Rollback target: `pre-workos-migration-2026-05-30` git tag + Hetzner image snapshot |
| Add `workosUserId` field to User | Schema migration could fail | Low | Single ADD COLUMN, additive, Neon safety branch before apply |
| Drop Better Auth tables (`session`, `account`, `verification`) | Data loss if rolled back without restore | Medium | Take Neon safety branch BEFORE drop; don't drop tables in v1 — leave them, just stop writing to them |
| Update sign-in page redirect to AuthKit | Existing chris@pexlo.com sessions invalidated | Low | Acceptable; document for Chris |
| Cookie domain edge cases | AuthKit cookie doesn't propagate through Caddy | Medium | Test on staging path (or local with port forwarding) first |
| Magic link email "from" address | Goes from `portal@pexlo.com` to WorkOS default | Low | Configure custom domain in WorkOS dashboard before migration |
| Google OAuth | DEFERRED to v2 (dashboard config flip when re-enabled, no code change) | — | — |
| Caddy reverse proxy + WorkOS cookies | Cookies don't reach app container | Medium | Verify cookie path/domain in Caddy logs after first deploy |
| The PXL-6 status page `queries.ts` uses `getSession()` from `lib/auth.ts` | Auth check breaks the status page | Medium | Update `lib/auth.ts` to wrap WorkOS's `withAuth()` |

### What's the rollback path?

1. **Code:** `git reset --hard pre-workos-migration-2026-05-30` + push (force) → GitHub Actions doesn't auto-deploy here (Hetzner is SSH), so safe
2. **Image:** `docker tag pexlo-portal:pre-workos-migration-2026-05-30 pexlo-portal:latest && docker compose up -d --force-recreate atrium`
3. **Database:** If we dropped Better Auth tables: restore from `pre-workos-migration-2026-05-30` Neon branch
4. **Env vars:** `BETTER_AUTH_SECRET` stays in `.env` (just unused); ADD `WORKOS_*` vars

### Hard stops during migration

- If Bun install fails after adding `@workos-inc/authkit-nextjs` → STOP, investigate peer dep issue
- If `auth.service.ts` refactor breaks the build → STOP, don't commit
- If first deploy attempt logs show cookie missing → STOP, investigate Caddy
- If sign-in flow doesn't return a session → STOP, investigate WorkOS callback handler

## 6. Step-by-step migration brief (FOR CRANK)

### Phase 0 — Safety nets (15 min)
1. [x] Verify WorkOS account state (pre-flight inventory above) — DONE Sat AM
2. [x] Generate WorkOS cookie password → Keychain `workos-pexlo-cookie-password` (account `chris@dwelbase.io`) — DONE Fri eve
3. [ ] Add to Hetzner `/opt/pexlo-portal/.env` (Crank's hands):
   - `WORKOS_API_KEY` from Keychain `workos-pexlo-api-key` (account `chris@pexlo.com`)
   - `WORKOS_CLIENT_ID` from Keychain `workos-pexlo-client-id` (account `chris@pexlo.com`)
   - `WORKOS_COOKIE_PASSWORD` from Keychain `workos-pexlo-cookie-password` (account `chris@dwelbase.io`)
   - `WORKOS_REDIRECT_URI=https://portal.pexlo.com/api/auth/callback`
4. [x] Pexlo Portal Neon safety branch `pre-workos-migration-2026-05-30` — DONE Sat 09:58 EDT (`br-still-sunset-aqgtwm8o`, parent `br-super-credit-aqwsbfbh`, LSN `0/2ED60B0`)
5. [x] Git tag current main `pre-workos-migration-2026-05-30` — DONE Sat 09:58 EDT (`cc59312`, pushed to origin)
6. [ ] Tag current Hetzner Docker image `pexlo-portal:pre-workos-migration-2026-05-30` — DEFERRED to Crank (SSH access from Hetzner box)
7. [ ] Chris does 2 dashboard steps in §4a (~2 min): add 2 redirect URIs + toggle Magic Auth ON

### Phase 1 — Schema migration (15 min)
1. Add `User.workosUserId String? @unique`
2. Create Prisma migration
3. Apply via `migrate deploy` (additive — should succeed without drama)
4. Verify migration row in `_prisma_migrations`

### Phase 2 — Install WorkOS, remove Better Auth (1 hour)
1. `bun add @workos-inc/authkit-nextjs @workos-inc/node --filter @atrium/web`
2. Same for `@atrium/api` if NestJS controllers need direct WorkOS SDK
3. Remove `better-auth` from `apps/api/package.json` (DON'T remove from `apps/web` yet — used by middleware)
4. Refactor `apps/api/src/auth/auth.service.ts` → `workos.service.ts`
5. Refactor `apps/api/src/auth/session.middleware.ts` → use WorkOS cookie pattern
6. Update `apps/web/src/lib/auth.ts` `getSession()` to use WorkOS
7. Replace `apps/web/src/app/(portal)/portal/sign-in/page.tsx` with AuthKit redirect (signed redirect to hosted page)
8. Add `apps/web/src/app/api/auth/callback/route.ts` for WorkOS callback handling
9. Update `apps/api/src/notifications/in-app-notifications.controller.ts` AuthGuard to work with WorkOS sessions
10. Test build locally

### Phase 3 — Data migration (15 min)
1. Map existing `chris@pexlo.com` user → WorkOS via WorkOS Users API (creates new WorkOS user, links to existing Prisma user via `workosUserId`)
2. Map Pexlo organization → WorkOS Organization
3. (Skip for v1: bulk migrate other test users — they'll re-onboard via WorkOS on next login)

### Phase 4 — Deploy + verify (30 min)
1. Build new image on Hetzner with PXL-18 entrypoint discipline (SKIP_DB_PUSH=true first boot, then false)
2. Verify magic link flow end-to-end (request → email → click → land authenticated)
3. ~~Verify Google OAuth flow~~ — DEFERRED to v2
4. Verify PXL-6 status URL renders for authenticated user
5. Verify `chris@pexlo.com` session lands in correct org with correct project visibility

### Phase 5 — Cleanup (15 min)
1. Drop `better-auth` from `apps/web/package.json` (no longer needed for sign-in)
2. Keep Better Auth tables in DB (don't drop in v1 — rollback safety)
3. Update build doc: `docs/build/08-workos-auth.md`
4. Linear: close PXL-6, file PXL-23 for "Drop Better Auth tables (v2)"

**Total: ~3 hours focused work. Fresh-brain Saturday morning = realistic finish by lunch.**

## 7. Verification gates (DO NOT SKIP)

Each gate is "stop and verify before proceeding":

- **Gate A** (after Phase 0): WorkOS Keychain entries set ✅, Neon safety branch ✅, git tag ✅, Hetzner image tag (Crank), Hetzner .env updated (Crank), Chris dashboard prep done (2 redirect URIs + Magic Auth toggle). Stop, confirm to Omni. (Google OAuth step removed — deferred to v2.)
- **Gate B** (after Phase 1): Prisma migration row exists. New column `User.workosUserId` exists. Production data row counts UNCHANGED.
- **Gate C** (after Phase 2 local build): `bun run build` passes. No TypeScript errors. No "Better Auth" imports remaining in API code.
- **Gate D** (after Phase 3): chris@pexlo.com row has `workosUserId` populated.
- **Gate E** (after Phase 4 first boot SKIP_DB_PUSH=true): Container Up. Production DB row counts UNCHANGED.
- **Gate F** (after Phase 4 second boot): Magic link flow works end-to-end. Status URL renders for authenticated user.
- **Gate G** (after Phase 5): Build doc committed. PXL-6 closed in Linear.

## 8. Known gaps / deferred to v2

- **Custom AuthKit UI** — using hosted AuthKit page in v1; consider custom Pexlo-branded UI in v2 if needed
- **Dropping Better Auth tables** — keep in DB for v1 rollback safety; drop in v2
- **Microsoft 365 SSO** — config flip in WorkOS dashboard when CSP requests it ($125/mo)
- **Bulk migration of test users** — defer; they'll re-onboard via WorkOS on next login
- **AuditLogs API integration** — defer; PXL-19 audit_event table covers our needs for now
- **SCIM provisioning** — defer until we have a client that needs it

## 9. References

- WorkOS Next.js docs: https://workos.com/docs/user-management/nextjs
- AuthKit docs: https://workos.com/docs/user-management/authkit
- Pexlo Portal current auth: `apps/api/src/auth/auth.service.ts`
- May 26 memory: `memory/2026-05-26.md` (WorkOS resources provisioned)
- May 29 memory: `memory/2026-05-29.md` (auth decision locked at 17:43 EDT)
- AGENTS.md Hard Rules 7-14 (data safety) + Investigative QC section
- PXL-18 entrypoint safety pattern (`docs/build/06-docker-entrypoint-safety.md`)

---

## TL;DR for Saturday morning

1. Read this doc
2. Verify WorkOS account state (Section 4 inventory)
3. Generate cookie password + Keychain
4. Take all 3 safety nets (Neon branch + git tag + image tag)
5. Run Phase 1 → Gate B
6. Run Phase 2 → Gate C
7. Run Phase 3 → Gate D
8. Run Phase 4 → Gates E + F
9. Run Phase 5 → Gate G

Expected finish: lunch Saturday, fresh brain, no incidents.
