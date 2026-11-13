#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
expect_rejected() {
  local url="$1"
  if CI_DATABASE_URL="$url" CI_DATABASE_IS_DISPOSABLE=yes NODE_ENV=test bash "$ROOT/scripts/verify.sh" >/dev/null 2>&1; then
    echo "FAIL: unsafe database URL was accepted" >&2
    exit 1
  fi
}
expect_rejected "postgresql://ci:password@production.example.com:5432/dira_ci"
expect_rejected "postgresql://ci:password@localhost:5432/production"
expect_rejected "postgresql://ci:password@localhost:5432/postgres"
expect_rejected "postgresql://ci:password@localhost:5432/dira_ci?schema=public&host=production.example.com"
echo "Unsafe database URL rejection cases completed (passing requires execution)."
