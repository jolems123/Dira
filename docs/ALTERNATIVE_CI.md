# Independent CI while GitHub Actions billing is blocked

GitHub Actions failures with no runner assigned or steps executed are not evidence that Dira's tests fail. GitLab CI is supported as an **alternative runner**, but this repository's presence on GitLab and availability of a GitLab runner have **not** been verified.

## Supported execution

The exact verification sequence is implemented in `scripts/verify.sh` and used by `.gitlab-ci.yml`:

1. `npm ci`
2. Prisma client generation
3. `prisma migrate deploy` against a **disposable** PostgreSQL database only
4. `npm run typecheck`
5. API Vitest suite
6. API + web builds
7. `npm audit --omit=dev --audit-level=high`

To activate alternative CI, import or mirror `jolems123/Dira` into GitLab and enable a GitLab runner with PostgreSQL service-container support. `.gitlab-ci.yml` starts a fresh PostgreSQL 16 service with CI-only credentials and runs the script for branch and merge-request pipelines. Do not use real customer data.

To use a different CI vendor, launch a disposable PostgreSQL 16 database, set `CI_DATABASE_URL` to its URL, set `CI_DATABASE_IS_DISPOSABLE=yes`, and run `bash scripts/verify.sh` from the repository root. The guard explicitly refuses production NODE_ENV and requires an affirmative disposable-database marker. That marker must only be set after confirming database isolation; it is not proof of isolation.

## Current evidence
- Shell syntax of `scripts/verify.sh` was checked with `bash -n` using an independent Node 22 environment: **PASS**.
- Full typecheck, migrations, API tests, web build, production audit: **NOT RUN** in that environment. The runner cannot resolve github.com and therefore cannot clone the project or install project dependencies.
- GitHub Actions runner jobs have failed before any steps, reportedly due to an account billing issue. This explains absent step logs but does not certify source code.
- No GitLab pipeline has been executed, and this is not a claim of alternative-CI success.
- Do not merge the security PR while unverified critical security gaps remain. Re-run all release checks in an accessible runner.

## Release gate
Required status is independently verified green or formally reviewed equivalent passing evidence, plus completed tenant/role isolation, approval boundaries, data security, and operational checks. Do not disable security gates merely to work around billing.
