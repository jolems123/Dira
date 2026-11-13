#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
expect_rejected() {
  local url="$1" output status
  # A failure in npm ci or Prisma must never count as a passing guard test.
  set +e
  output="$(CI_DATABASE_URL="$url" CI_DATABASE_IS_DISPOSABLE=yes NODE_ENV=test bash "$ROOT/scripts/verify.sh" 2>&1)"
  status=$?
  set -e
  if [[ "$status" -ne 2 ]] || [[ "$output" != *"ERROR: CI database must be on localhost/postgres and named *_ci or *_test."* ]]; then
    echo "FAIL: expected database guard rejection (exit 2), got exit $status" >&2
    exit 1
  fi
}
expect_rejected "postgresql://ci:password@production.example.com:5432/dira_ci"
expect_rejected "postgresql://ci:password@localhost:5432/production"
expect_rejected "postgresql://ci:password@localhost:5432/postgres"
expect_rejected "postgresql://ci:password@localhost:5432/dira_ci?schema=public&host=production.example.com"
echo "PASS: four unsafe database URLs rejected by the guard before npm or migrations."
