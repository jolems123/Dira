# Independent verification (when GitHub-hosted Actions cannot start)

Use a trusted, isolated Linux runner with Node.js 22, npm, Docker and Docker Compose. This procedure is **not** a substitute for required GitHub branch-protection checks or independent review. Never run it against production or shared databases.

1. Check out the exact pull-request head SHA in a disposable working directory; record that SHA in the PR.
2. Start a **fresh, isolated** PostgreSQL 16 container bound to loopback with a unique ephemeral database and credentials. Do not reuse Railway or any shared `DATABASE_URL`.
3. Export `NODE_ENV=test`, `DATABASE_URL` pointing only to that disposable instance, test-only `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (at least 32 characters), `WEB_ORIGIN=http://localhost:3000`, and `API_URL=http://localhost:4000`. Do not print environment variables or secrets.
4. From the repository root, execute the following commands in order, stopping at the first failure:

```sh
npm ci
npm run db:generate
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm run typecheck
npm test --workspace apps/api
npm run build
npm audit --omit=dev --audit-level=high
```

5. Preserve the command exit codes, redacted logs, exact commit SHA, Node/npm versions and PostgreSQL version as a signed or otherwise attributable verification artifact. Run route-level tenant-isolation, approval and concurrent-write integration tests with the disposable database before declaring the security phase complete.
6. Dispose of **only** the dedicated test database/container after verification. Never execute `prisma migrate reset`, `docker compose down -v`, or destructive commands against shared infrastructure.
7. If required GitHub checks cannot execute because of account billing/runner restrictions, mark them **blocked**, not passed. Restore the runner or have the repository owner configure an approved check-reporting alternative before merging. Never bypass review or branch protection.

Dira records supplier payments only; this workflow must not activate supplier money movement or live Paddle subscriptions.
