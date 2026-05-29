# PXL-6 Deploy Runbook (2026-05-29)

## Pre-deploy state captured

### Git
- Pre-merge tag: `pre-pxl-6-merge-2026-05-29`
- Pre-merge main commit: `d781d53` (Merge PXL-17: test database isolation guardrails)
- About to merge: commits `bdc01ca` (PXL-6) + `d7f3725` (aliases followup)
- Origin tag verification:
  - Annotated tag: `152eca240045f107dc102efc5eac9bc0d11dfdd2`
  - Peeled commit: `d781d5330c5ca904e4f92ab59c7ce5ec83deb657`

### Neon
- Safety branch: `pre-pxl-6-merge-2026-05-29` (id: `br-misty-sunset-aqwrfzvg`)
- Endpoint: `ep-super-boat-aqv8osp1.c-8.us-east-1.aws.neon.tech`
- Pooler host: `ep-super-boat-aqv8osp1-pooler.c-8.us-east-1.aws.neon.tech`
- Connection URI (masked): `postgresql://neondb_owner:****@ep-super-boat-aqv8osp1.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require`
- Parent: `br-super-credit-aqwsbfbh` (production main)

### Production data baseline (pre-deploy)
Target host: `ep-morning-forest-aqndvm5t-pooler.c-8.us-east-1.aws.neon.tech`

```text
t         | c  
-------------------+----
 api_key           |  2
 audit_event_agent | 56
 organizations     | 71
 projects          | 30
 projects_agent    |  3
 task_deliverable  | 27
 tasks             | 17
 tasks_agent       | 13
 users             | 76
(9 rows)
```

### Docker image (currently running on Hetzner)
- Latest digest: `sha256:d4f238d8893691cddcffb49d9d3ed40b51ea6b83ec8f6c4938da3632d3423fff`
- Latest pushed: `2026-05-20T02:53:17.97083Z`
- SHA-tagged previous good: `vibralabs/atrium:6ede196f2eb33fab904c7c99b0d039f2497e2c72`
- Note: no Docker Hub tag found for current local `main` commit `d781d53`; `latest` currently resolves to `6ede196f2eb33fab904c7c99b0d039f2497e2c72`.
- Hetzner: `5.161.84.89`

Recent Docker tags captured:

```text
=== latest ===
Latest image digest: sha256:d4f238d8893691cddcffb49d9d3ed40b51ea6b83ec8f6c4938da3632d3423fff
Last pushed: 2026-05-20T02:53:17.97083Z
Full last_updater_username: vibralabs
=== recent tags ===
Recent tags:
  latest                                      pushed 2026-05-20T02:53:17.97083Z
  6ede196f2eb33fab904c7c99b0d039f2497e2c72    pushed 2026-05-20T02:53:15.528237Z
  39a15bf163773abc5059e4a2e63c438d381f89c4    pushed 2026-05-17T22:36:26.414256Z
  bf5a3d51728609577a59afed86a6850239b9d794    pushed 2026-05-03T01:44:04.538274Z
  207a8f532dbadba46236c32abc1ebd922e4cafdc    pushed 2026-05-01T02:02:06.981017Z
  0a0e92d846444fd304f2aa7c616a4f1228a1fe13    pushed 2026-04-29T03:31:17.749042Z
  1e16fab5f03053595e71a9dcb57999eb34ce5092    pushed 2026-04-28T20:45:03.943291Z
  6ccdb915e92763eca15bba5df9b129e89a66823b    pushed 2026-04-28T03:00:38.465461Z
  74793f6fcd80f80b326344bbcb7671a93c76bfa5    pushed 2026-04-26T18:19:14.167183Z
  e4b825c9d8607669ed195e96f837e90866c92fe4    pushed 2026-04-26T17:45:45.247648Z
```

### GitHub Actions secrets verified
Confirmed present:
- `GOOGLE_CLIENT_ID` (added in this run from Keychain)
- `GOOGLE_CLIENT_SECRET` (added in this run from Keychain)

Missing / blocking before merge:
- `BETTER_AUTH_SECRET`
- `DATABASE_URL`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `RESEND_API_KEY`
- `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`

### Health baseline
```text
=== portal.pexlo.com health (BEFORE deploy) ===
HTTP/2 200 
alt-svc: h3=":443"; ma=2592000
cache-control: s-maxage=31536000
content-security-policy: frame-src 'self' blob: https://www.youtube.com https://www.loom.com https://www.figma.com https://docs.google.com https://www.canva.com https://canva.com https://open.spotify.com https://w.soundcloud.com https://soundcloud.com https://codepen.io https://player.vimeo.com;
content-type: text/html; charset=utf-8
date: Fri, 29 May 2026 18:20:10 GMT
etag: "6g3f69v9so8l9"
permissions-policy: camera=(), microphone=(), geolocation=()
referrer-policy: strict-origin-when-cross-origin
strict-transport-security: max-age=31536000; includeSubDomains
vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept-Encoding
via: 1.1 Caddy
via: 1.1 Caddy
x-content-type-options: nosniff
x-nextjs-cache: HIT

portal.pexlo.com: HTTP 200 · time 0.047484s
/api/health: HTTP 200 · time 0.054379s
```

Summary:
- `portal.pexlo.com`: HTTP 200 in 0.047484s
- `/api/health`: HTTP 200 in 0.054379s

## Blocker

Phase 0 is **not complete**: required GitHub Actions secrets are missing from `Bizman365/Atrium`. Do not merge PXL-6 until those secrets are present or the deploy workflow/runtime secret strategy is corrected.

## Rollback procedures

### Option 1: Revert Git only (if just a code regression, no schema/data changes)
```bash
git checkout main
git reset --hard pre-pxl-6-merge-2026-05-29
git push --force origin main
# Wait for GitHub Actions to rebuild + Hetzner to pull
```

### Option 2: Revert Docker image (faster if Hetzner is broken)
```bash
ssh root@5.161.84.89
docker pull vibralabs/atrium:6ede196f2eb33fab904c7c99b0d039f2497e2c72
docker tag vibralabs/atrium:6ede196f2eb33fab904c7c99b0d039f2497e2c72 vibralabs/atrium:latest
docker compose -f /path/to/compose.yml up -d
```

### Option 3: Revert DB (only if data corruption)
- Neon safety branch `pre-pxl-6-merge-2026-05-29` is the rollback target
- Safety branch id: `br-misty-sunset-aqwrfzvg`
- Switch `DATABASE_URL` to the safety branch URI, or use Neon's restore branch feature.
