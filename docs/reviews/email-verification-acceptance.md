# Email verification security acceptance specification

Status: DESIGN ONLY — not implemented, tested, or approved for production.

## Non-negotiable security invariant
An account with `emailVerified=false` must not receive or use an access or refresh credential. Existing sessions for accounts transitioning to unverified, suspended, or inactive must be denied and revoked. Registration must not issue an authenticated session.

## Implementation order (security PR #3)
1. Add a separate single-use verification credential model, with a SHA-256 token digest (never plaintext), user ID, expiry, consumed timestamp, and created timestamp. Index by user and expiry. Create an additive Prisma migration; never edit applied migrations or mutate a shared database.
2. Add an atomic issuance operation: cryptographically random token, bounded lifetime, resend cooldown and per-user/IP limits. Revoke previous unconsumed tokens in the same transaction. Ensure concurrent requests cannot exceed limits.
3. Add transactional verification: consume a valid, unexpired token once and set `emailVerified=true` and `status=ACTIVE` atomically. Replay, expiry, and races must fail closed.
4. Implement verified-domain email delivery with a safe URL, and a generic public response that does not reveal account existence or leak tokens. Revoke an undelivered credential; do not log the token. Provide a resend path and recovery UX.
5. Update registration to create a pending, unverified account without issuing access/refresh tokens or setting the refresh cookie. Update login, refresh, and request authentication middleware to enforce both active status and verified email. Existing refresh tokens for ineligible users must be revoked.
6. Determine a documented migration policy for legacy accounts with `emailVerified=false` before deployment. Do not silently mark addresses verified or strand existing accounts without a resend/recovery path.

## Required independent evidence
- Register returns pending status without credentials or refresh cookie.
- Delivery failure and retry never reveal bearer tokens.
- Verify once succeeds; replay, expiry, concurrency and tampered tokens fail.
- Login, refresh, and protected API requests reject unverified users; previously issued credentials are denied.
- Cross-tenant access and role/approval tests pass with a disposable PostgreSQL database.
- Typecheck, migrations, API tests and browser registration-to-verification flow pass without GitHub-hosted paid CI.

## Release constraints
Supplier payments are record-only. Live Paddle subscriptions require separate explicit approval. No historical secret rewriting or force pushes. Do not merge this security phase without test evidence and required review.
