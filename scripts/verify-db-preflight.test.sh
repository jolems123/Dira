#!/usr/bin/env bash
# Offline regression for verify.sh's preflight. No database, npm install or migration is executed.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
cat > "$TMP/bin/npm" <<'EOF'
#!/usr/bin/env bash
printf 'npm %s\n' "$*" >> "$VERIFY_GUARD_CALLS"
EOF
cat > "$TMP/bin/npx" <<'EOF'
#!/usr/bin/env bash
printf 'npx %s\n' "$*" >> "$VERIFY_GUARD_CALLS"
EOF
chmod +x "$TMP/bin/npm" "$TMP/bin/npx"
export PATH="$TMP/bin:$PATH"
export VERIFY_GUARD_CALLS="$TMP/calls"
: > "$VERIFY_GUARD_CALLS"
check_rejected() {
  local label="$1" url="$2" flag="$3" envmode="$4" output status
  : > "$VERIFY_GUARD_CALLS"
  status=0
  output="$(CI_DATABASE_URL="$url" CI_DATABASE_IS_DISPOSABLE="$flag" NODE_ENV="$envmode" bash "$ROOT/scripts/verify.sh" 2>&1)" || status=$?
  if [[ "$status" != 2 || "$output" != *'ERROR:'* ]]; then
    printf 'FAIL %s: expected guard exit 2 and ERROR; got %s\n' "$label" "$status" >&2
    exit 1
  fi
  if [[ -s "$VERIFY_GUARD_CALLS" ]]; then
    printf 'FAIL %s: invoked npm/npx before rejecting unsafe URL\n' "$label" >&2
    exit 1
  fi
}
check_rejected 'remote host' 'postgresql://example.com/company_test' yes test
check_rejected 'production database name' 'postgresql://localhost/company' yes test
check_rejected 'missing disposable acknowledgement' 'postgresql://localhost/company_test' no test
check_rejected 'production environment' 'postgresql://localhost/company_test' yes production
check_rejected 'socket override' 'postgresql://localhost/company_test?host=/tmp' yes test
check_rejected 'schema override' 'postgresql://localhost/company_test?socket=/tmp' yes test
check_rejected 'hostaddr override' 'postgresql://localhost/company_test?hostaddr=203.0.113.10' yes test
check_rejected 'service override' 'postgresql://localhost/company_test?service=production' yes test
check_rejected 'encoded database path' 'postgresql://localhost/company%2Ftest' yes test
: > "$VERIFY_GUARD_CALLS"
CI_DATABASE_URL='postgresql://localhost/company_test' CI_DATABASE_IS_DISPOSABLE=yes NODE_ENV=test bash "$ROOT/scripts/verify.sh" >/dev/null
if ! grep -q '^npm ci$' "$VERIFY_GUARD_CALLS" || ! grep -q '^npx prisma migrate deploy' "$VERIFY_GUARD_CALLS"; then
  echo 'FAIL: disposable local database did not reach mocked checks' >&2
  exit 1
fi
echo 'PASS: verification database preflight (offline; mocked npm/npx only)'
