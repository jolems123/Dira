#!/usr/bin/env bash
# Run Dira checks against an explicitly designated, disposable PostgreSQL database.
set -Eeuo pipefail

if [[ -z "${CI_DATABASE_URL:-}" ]]; then
  echo 'ERROR: CI_DATABASE_URL is required (dedicated disposable database only).' >&2
  exit 2
fi
if [[ "${CI_DATABASE_URL}" != postgresql://* && "${CI_DATABASE_URL}" != postgres://* ]]; then
  echo 'ERROR: CI_DATABASE_URL must use PostgreSQL.' >&2
  exit 2
fi
# The disposable flag alone is insufficient: reject remote/shared hosts and
# non-test database names before any Prisma migration or test process starts.
if ! node -e '
  try {
    const u = new URL(process.env.CI_DATABASE_URL);
    const allowed = new Set(["localhost", "127.0.0.1", "[::1]", "postgres"]);
    const name = decodeURIComponent(u.pathname.slice(1));
    if (!allowed.has(u.hostname) || !/^[a-zA-Z0-9_]+_(ci|test)$/.test(name)
      || u.searchParams.has("host") || u.searchParams.has("socket")) process.exit(1);
  } catch { process.exit(1); }
'; then
  echo 'ERROR: CI database must be on localhost/postgres and named *_ci or *_test.' >&2
  exit 2
fi
if [[ "${CI_DATABASE_IS_DISPOSABLE:-}" != 'yes' ]]; then
  echo 'ERROR: set CI_DATABASE_IS_DISPOSABLE=yes only for an isolated test database.' >&2
  exit 2
fi
if [[ "${NODE_ENV:-test}" == 'production' ]]; then
  echo 'ERROR: refusing to run CI checks with NODE_ENV=production.' >&2
  exit 2
fi
export NODE_ENV=test
export DATABASE_URL="$CI_DATABASE_URL"
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-ci-only-dira-access-token-secret-at-least-32-chars}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-ci-only-dira-refresh-token-secret-at-least-32-chars}"
export WEB_ORIGIN="${WEB_ORIGIN:-http://localhost:3000}"
export API_URL="${API_URL:-http://localhost:4000}"

npm ci
npm run db:generate
# migrate deploy applies migrations ONLY to the designated disposable CI database.
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run typecheck
npm test --workspace apps/api
npm run build
npm audit --omit=dev --audit-level=high
