#!/usr/bin/env bash
# Gate B / Gate E verification: production DB row counts must match this baseline
# Captured by Omni Sat 2026-05-30 10:14 EDT (cc59312 main, pre-Phase 1)
#
# Usage:
#   ./scripts/verify-workos-migration.sh

set -eo pipefail

PEXLO_DB="${DATABASE_URL:-$(security find-generic-password -s 'pexlo-portal-db' -w 2>/dev/null || true)}"

if [ -z "$PEXLO_DB" ]; then
  echo "ERROR: DATABASE_URL not set and pexlo-portal-db not found in Keychain" >&2
  exit 1
fi

BASELINE_DATE="2026-05-30 10:14 EDT (pre-Phase 1, main at cc59312)"

baseline_for() {
  case "$1" in
    users)            echo 77 ;;
    organizations)    echo 71 ;;
    projects_total)   echo 30 ;;
    projects_agent)   echo 3 ;;
    tasks_total)      echo 17 ;;
    tasks_agent)      echo 13 ;;
    api_key)          echo 2 ;;
    audit_event)      echo 73 ;;
    task_deliverable) echo 27 ;;
    comment)          echo 13 ;;
    project_update)   echo 5 ;;
    session)          echo 5 ;;
    account)          echo 2 ;;
    verification)     echo 0 ;;
    *)                echo "?" ;;
  esac
}

CURRENT=$(psql "$PEXLO_DB" -t -A -F'|' -c "
  SELECT 'users', COUNT(*) FROM \"user\"
  UNION ALL SELECT 'organizations', COUNT(*) FROM organization
  UNION ALL SELECT 'projects_total', COUNT(*) FROM project
  UNION ALL SELECT 'projects_agent', COUNT(*) FROM project WHERE source = 'agent'
  UNION ALL SELECT 'tasks_total', COUNT(*) FROM task
  UNION ALL SELECT 'tasks_agent', COUNT(*) FROM task WHERE source = 'agent'
  UNION ALL SELECT 'api_key', COUNT(*) FROM api_key
  UNION ALL SELECT 'audit_event', COUNT(*) FROM audit_event
  UNION ALL SELECT 'task_deliverable', COUNT(*) FROM task_deliverable
  UNION ALL SELECT 'comment', COUNT(*) FROM comment
  UNION ALL SELECT 'project_update', COUNT(*) FROM project_update
  UNION ALL SELECT 'session', COUNT(*) FROM \"session\"
  UNION ALL SELECT 'account', COUNT(*) FROM account
  UNION ALL SELECT 'verification', COUNT(*) FROM verification
  ORDER BY 1;
")

echo "Baseline: $BASELINE_DATE"
echo "Verifying current production DB..."
echo ""
printf "%-20s %10s %10s %10s\n" "TABLE" "BASELINE" "CURRENT" "DIFF"
printf "%-20s %10s %10s %10s\n" "-----" "--------" "-------" "----"

DRIFT=0
while IFS='|' read -r tbl rows; do
  [ -z "$tbl" ] && continue
  base=$(baseline_for "$tbl")
  cur="$rows"
  diff="?"
  if [ "$base" != "?" ]; then
    diff=$((cur - base))
  fi
  marker=""
  if [ "$diff" != "0" ] && [ "$diff" != "?" ]; then
    marker=" ⚠️"
    DRIFT=$((DRIFT + 1))
  fi
  printf "%-20s %10s %10s %10s%s\n" "$tbl" "$base" "$cur" "$diff" "$marker"
done <<< "$CURRENT"

echo ""
if [ "$DRIFT" -eq 0 ]; then
  echo "✅ No drift from baseline. Gate verification PASSED."
  exit 0
else
  echo "⚠️  $DRIFT table(s) drifted from baseline."
  echo ""
  echo "ALLOWED drift during migration:"
  echo "  - Phase 1 (schema): ZERO row count changes (additive ADD COLUMN only)"
  echo "  - Phase 3 (data):   users may +1, workosUserId populated"
  echo "  - Phase 4 (deploy): session/verification may differ (transient auth state)"
  echo ""
  echo "Anything else = STOP, investigate, yield to Omni."
  exit 1
fi
