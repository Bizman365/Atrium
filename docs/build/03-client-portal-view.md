# 03 — Client Portal View

## 1. What

`portal.pexlo.com/portal/status/[slug]` is a read-only client status view for Pexlo projects, protected by Better Auth magic link + Google OAuth and styled in the editorial Pexlo brand direction.

## 2. Why

This is the first client-facing surface in Pexlo Portal. It gives Soyini and future clients a clean substantiation URL for project progress, deliverables, and task state without exposing internal operator tooling.

It also doubles as part of the R&D credit evidence pack: the client-visible project record, deliverable links, task metadata, and audit-backed status output help prove that AI-development work happened, when it happened, and what it produced.

## 3. Considered & Rejected

- **WorkOS migration now** — rejected because Better Auth is already wired with `magicLink` and `organization` plugins. Shipping on the existing stack is faster and lower-risk. WorkOS remains PXL-19 backlog work when budget and migration testing time are available.
- **Auto-provision by email domain** — rejected as a v2 feature. Manual invite through the existing Better Auth organization plugin is sufficient for the first client today.
- **Custom domain `client.pexlo.com`** — rejected because it requires unnecessary DNS and deployment work. `portal.pexlo.com` is already deployed and the `/portal/status/[slug]` route is clear enough.
- **Signed URL public access without login** — rejected because it is less audit-friendly than an authenticated session. Better Auth organization membership gives tenant scoping and access checks without inventing a parallel access model.
- **Magic link only without Google** — rejected by Chris. Google OAuth was worth the small extra implementation cost because it removes friction for clients who prefer one-click Google sign-in.

## 4. What We Built

- `apps/web/src/app/(portal)/portal/status/[slug]/page.tsx` — server component for the authenticated project status page.
- `apps/web/src/app/(portal)/portal/status/[slug]/queries.ts` — data fetching and access-control logic for slug lookup, organization membership, and sign-in redirects.
- `apps/web/src/app/(portal)/portal/status/[slug]/components/*.tsx` — 7 focused view components:
  - `deliverable-link.tsx`
  - `page-header.tsx`
  - `portal-footer.tsx`
  - `project-title.tsx`
  - `stat-band.tsx`
  - `task-list.tsx`
  - `task-row.tsx`
- `apps/web/src/app/(portal)/portal/status/[slug]/not-found.tsx` and `forbidden.tsx` — explicit missing-project and unauthorized states.
- `apps/web/src/app/(portal)/portal/sign-in/page.tsx` and `sign-in-form.tsx` — client portal sign-in UI with magic link and Google OAuth options.
- `apps/web/src/app/(portal)/portal/sign-in/check-email/page.tsx` — magic-link confirmation screen.
- `apps/api/src/auth/auth.service.ts` — added the Google `socialProviders` block to the existing Better Auth configuration.
- `apps/web/tailwind.config.ts` — added Pexlo brand tokens including `pexlo.terracotta`, warm paper surfaces, ink colors, and supporting neutrals.
- `scripts/invite-client-member.ts` — CLI for Chris to invite client users into a project organization.
- `e2e/tests/client-status-view.e2e.ts` — Playwright access-flow coverage for unauthenticated, missing-project, and wrong-organization cases.
- `.env.example` — added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` placeholders.

The canonical route folders are the nested `/portal/...` paths under the Next.js `(portal)` route group:

- kept: `apps/web/src/app/(portal)/portal/status/[slug]/`
- kept: `apps/web/src/app/(portal)/portal/sign-in/`
- removed duplicate unprefixed folders: `apps/web/src/app/(portal)/status/[slug]/` and `apps/web/src/app/(portal)/sign-in/`

## 5. How to Extend

### Add new social providers

Add the provider configuration to the Better Auth `socialProviders` object in `apps/api/src/auth/auth.service.ts`, add placeholders to `.env.example`, and expose the option in `apps/web/src/app/(portal)/portal/sign-in/sign-in-form.tsx` only after the provider is configured in the live environment.

### Add a new client theme

Keep shared layout structure in the existing page/components and add brand tokens in `apps/web/tailwind.config.ts`. Prefer client-specific tokens and small component variants over route forks so the access-control and data-fetching logic stays centralized.

### Add new status sections

Extend `queries.ts` first so the server component receives a typed view model. Then add focused components beside the existing status components. Likely next sections:

- client-visible comments or updates
- agent activity timeline
- time or effort summaries once real Toggl data exists
- file preview cards once deliverables have first-class file metadata

### Keep access checks server-side

Do not move slug lookup or organization membership checks into client components. The server component + query layer is the audit-friendly boundary: unauthenticated users redirect to `/portal/sign-in`, unknown slugs return 404, and non-members get 403.

## 6. Verification

```text
Test suite: 727 pass / 0 fail / 1191 expect() calls (45 web + 682 api)
Test isolation: confirmed running against TEST_DATABASE_URL (ep-wispy-darkness-aqghbc0b)
Production data: unchanged (3 projects / 13 tasks / 27 deliverables / 56 audit events from agent)
Specific PXL-6 tests passing:
  - client portal status access > redirects unauthenticated requests to client sign-in
  - client portal status access > returns 404 if slug does not exist
  - client portal status access > returns 403 if user is not a member of the project organization
```

Additional finish-up verification:

- Canonical route references point to `/portal/status/[slug]` and `/portal/sign-in`.
- Duplicate unprefixed route folders were removed.
- Root `bun run typecheck` is not defined in this repo; after clearing stale `.next/types`, direct source TypeScript checks passed for web and API:
  - `bunx tsc -p /tmp/pexlo-web-tsconfig-verify.json --noEmit --incremental false` — exit 0, source files checked excluding tests/generated `.next`.
  - `bunx tsc -p apps/api/tsconfig.json --noEmit --incremental false` — exit 0.
- No tests were re-run per the PXL-6 finish-up constraint.

## 7. Known Gaps / Deferred

- No mobile-specific optimization yet; the view relies on responsive Tailwind defaults.
- No time-tracking display. The hours stat is intentionally omitted per Chris's no-fake-numbers rule.
- No file preview; deliverables are external links only.
- No agent comment/update endpoints yet — PXL-19 backlog.
- No agent time logging yet — PXL-20 backlog.
- Real Toggl integration remains backlog work — PXL-21.
- WorkOS migration is deferred — PXL-19, separate from agent comment work.
- Google OAuth client secret rotation is pending because the previous secret was sent through chat per the security note.

## 8. References

- PXL-6 — Client Portal View.
- PXL-5 — Agent API layer that supplies project/task/deliverable data.
- PXL-7 — CSP project/task/deliverable backfill.
- PXL-17 — Test database isolation that made the verification run safe.
- `csp-rd-credit-program-overview.html` — visual reference for the editorial R&D briefing style.
