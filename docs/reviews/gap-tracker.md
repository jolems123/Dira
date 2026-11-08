# Dira launch gap tracker

Status is evidence-based: OPEN, IN PROGRESS, FIXED (verified), BLOCKED. Never call an untested change FIXED.

| Area | Gap | Severity | File:line | Fix | Test | Status |
|---|---|---|---|---|---|---|
| Production configuration | Unsafe JWT and hard-coded database defaults | Critical | apps/api/src/lib/env.ts | Validate production config and remove embedded database credentials | env validation unit tests | IN PROGRESS |
| JWT validation | Algorithm/issuer/audience unpinned | Critical | apps/api/src/routes/auth.ts, middleware/auth.ts | Explicit JWT claims and verification | token tests | OPEN |
| Refresh session | Concurrent refresh/replay revocation | Critical | apps/api/src/routes/auth.ts | Atomic session-family rotation and replay detection | concurrent request tests | OPEN |
| Tenant security | Complete buyer and supplier route isolation not proven | Critical | apps/api/src/routes/* | Endpoint-by-endpoint scoped authorization | cross-tenant tests | OPEN |
| Segregation of duties | Request and PO self-approval; invoice match gate | Critical | apps/api/src/routes/procurement.ts | Server-enforced separation/override audit | approval and match tests | OPEN |
| Storage | Upload allowlist, private S3 and audited expiring reads | High | apps/api/src/routes/documents.ts | Verify and strengthen controls | malicious upload tests | OPEN |
| Security operations | Production dependency/history scanning | High | package-lock.json, Git history | npm audit and gitleaks | CI evidence | OPEN |
| Global finance | Number arithmetic and fixed Uganda VAT | High | apps/api/src/lib/procurement-rules.ts | Decimal-safe configurable taxes, currency units | money precision tests | OPEN |
| Global onboarding | UGX defaults and locale settings | High | apps/api/prisma/schema.prisma | Add migration and explicit organization preferences | migration tests | OPEN |
| Global UX | i18n, time zones, multi-tax and fiscal adapters | High | apps/web, apps/api | Add configuration and adapters | locale/DST tests | OPEN |
| Differentiation | PWA, supplier links, multi-year budgets, stores, catalogues | High | apps/web, apps/api | Build complete workflows | E2E | OPEN |
| Integrations | Accounting exports and scoped API keys | Medium | apps/api | Build + document | contract tests | OPEN |
| Plans | Published prices and billing sandbox | High | apps/api, apps/web | Server-configured limits, Paddle sandbox | webhook tests | OPEN |
| Release | Real CI, accessibility, deployment, privacy/legal | High | repository | GitHub Actions and Railway docs | CI and Playwright | OPEN |

## NEEDS ME
Final plan prices; tax rules per country beyond reviewed profiles; live fiscal API integrations; sandbox/live merchant accounts; accounting credentials; Railway environment; private S3 bucket; email domain; legal review; any exposed or previously used secrets to rotate.

## Branches
- jolems123-patch-1: zero commits ahead of main, 10 behind; ancestor by compare API; deletion pending unsupported connector action.
- uganda-currency: identical to main; deletion pending unsupported connector action.
- fix/dira-security: working branch. Never merge to main automatically.
