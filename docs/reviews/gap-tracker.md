# Dira launch gap tracker

Status is evidence-based: OPEN, IN PROGRESS, FIXED (verified), BLOCKED. Never call an untested change FIXED.

| Area | Gap | Severity | File:line | Fix | Test | Status |
|---|---|---|---|---|---|---|
| Production configuration | Unsafe JWT and hard-coded database defaults | Critical | apps/api/src/lib/env.ts | Validate production config and remove embedded database credentials | env validation unit tests added; CI pending | IN PROGRESS |
| JWT validation | Algorithm/issuer/audience unpinned | Critical | apps/api/src/routes/auth.ts, middleware/auth.ts | Explicit JWT claims and verification implemented | token tests added; CI pending | IN PROGRESS |
| Refresh session | Concurrent refresh/replay revocation | Critical | apps/api/src/routes/auth.ts | Compare-and-swap rotation and replay revocation implemented; full family isolation pending | concurrent/replay tests added; CI pending | IN PROGRESS |
| Tenant security | Complete buyer and supplier route isolation not proven | Critical | apps/api/src/routes/* | Endpoint-by-endpoint scoped authorization | cross-tenant tests | OPEN |
| Segregation of duties | Request and PO self-approval; invoice match gate | Critical | apps/api/src/routes/procurement.ts | Self-approval blocked; further limits/PO threshold/override remain | self-approval tests added; CI pending | IN PROGRESS |
| Storage | Upload allowlist, private S3 and audited expiring reads | High | apps/api/src/routes/documents.ts | Added strict payload-length checks, WebP RIFF signature and CSV binary-null rejection; further authorization and S3 verification required | unit tests committed, CI pending | IN PROGRESS |
| Security operations | Production dependency/history scanning | High | package-lock.json, Git history | npm audit and gitleaks | CI evidence | OPEN |
| Global finance | Number arithmetic and fixed Uganda VAT | High | apps/api/src/lib/procurement-rules.ts | Decimal-safe configurable taxes, currency units | money precision tests | OPEN |
| Global onboarding | UGX defaults and locale settings | High | apps/api/prisma/schema.prisma | Add migration and explicit organization preferences | migration tests | OPEN |
| Global UX | i18n, time zones, multi-tax and fiscal adapters | High | apps/web, apps/api | Add configuration and adapters | locale/DST tests | OPEN |
| Differentiation | PWA, supplier links, multi-year budgets, stores, catalogues | High | apps/web, apps/api | Build complete workflows | E2E | OPEN |
| Integrations | Accounting exports and scoped API keys | Medium | apps/api | Build + document | contract tests | OPEN |
| Plans | Published prices and billing sandbox | High | apps/api, apps/web | Server-configured limits, Paddle sandbox | webhook tests | OPEN |
| Release | Real CI, accessibility, deployment, privacy/legal | High | repository | Initial GitHub Actions PR workflow added; Railway/Playwright outstanding | PR CI run 42516234541 queued; no result | BLOCKED |

## NEEDS ME
Final plan prices; tax rules per country beyond reviewed profiles; live fiscal API integrations; sandbox/live merchant accounts; accounting credentials; Railway environment; private S3 bucket; email domain; legal review; any exposed or previously used secrets to rotate.

## Branches
- jolems123-patch-1: zero commits ahead of main, 10 behind; ancestor by compare API; deletion pending unsupported connector action.
- uganda-currency: identical to main; deletion pending unsupported connector action.
- fix/dira-security: working branch. Never merge to main automatically.

## 2026-11-08 security work log
- `fix/dira-security`: positioning and tracker created; production environment validator; source-code database fallback sanitized (old history still contains password-like values; rotate any reused credentials); JWT issuer/audience/algorithm enforcement; refresh credential compare-and-swap and replay revocation; self-approval request gate; opt-in dev seed with hard production refusal; sanitized .env.example and local Docker Compose credentials; README updated; PR CI workflow. **Do not mark verified until CI completes successfully**.
- Refresh sessions presently have no durable per-device session-family identifier; replay handling revokes all user refresh credentials. Stronger per-session isolation is future work.
- Required auth cross-tenant/route tests, PO approval-limit rules, uploads and scan evidence remain unverified.

## Latest CI recheck
- PR #3 head `d37f8f2d7ecef079137fd36db816673a70a9fc1f`: GitHub Actions run `42516234541` (`Dira checks`), job `128839747454`, **queued**, no completed steps or test evidence at last check.
- PR remains DRAFT and GitHub reports mergeability state `unstable`. Do not merge until required checks pass and security-critical open items are addressed.
- Branch deletion requires a GitHub ref-deletion capability not exposed in the current connector; ordinary Git CLI in this execution environment cannot resolve github.com.
- Owner has now authorized merging verified completed phases, notwithstanding earlier no-merge instruction. No merge has occurred.

## 2026-11-09 engineering run
- Security commits `daa088b` and `7efbcdc`: reject missing or mismatched upload payload bytes, spoofed WebP signatures, and binary-null CSV uploads; six unit regression cases added in `apps/api/tests/upload-validation.test.ts`. These are **committed, not yet verified by CI**. Note that ZIP-based DOCX/XLSX still need archive structure inspection and malware scanning policy.
- Latest observed security PR head before changes `e630301` had GitHub Actions run `42521940250` queued. After upload commits, no workflow run was yet returned for `7efbcdc`; do not infer success.
- Reconfirmed `jolems123-patch-1` zero ahead/10 behind and `uganda-currency` zero ahead/zero behind main. Neither branch has unique commits; deletion capability remains unavailable.
- No merge attempted. Remaining critical tenant isolation, refresh session-family isolation, PO approval limits, invoice match enforcement, storage access tests, and operational credential rotation still block production readiness.

## 2026-11-09 CI failure investigation
- Security PR #3 head `6f9f054cf74af238d507ae1602ff163e067414ac` has GitHub Actions `Dira checks` run `42526909659` (run #22) **completed: FAILURE**; job `128872444767` failed. The connector's job-steps endpoint returned an empty array, and the log download returned a GitHub/Azure `BlobNotFound` 404. The failing command is therefore **unknown**; do not assume which test failed or claim remediation. Inspect the workflow run in GitHub Actions and retrieve logs when available before making a speculative CI change.
- No PR merge attempted: PR #3 remains draft with mergeability `unstable`, and critical tenant isolation/approval/refresh isolation are not fully verified.
- Reconfirmed `jolems123-patch-1` 0 ahead/10 behind main, `uganda-currency` identical; both safe to delete but current connector lacks delete-ref operation.
- NEEDS ME: recover CI job logs/runner availability, rotate any previously used historical secrets, provide final plan prices and reviewed jurisdictional tax rules, confirm Railway/S3/email/legal settings. No live billing activation approved.
