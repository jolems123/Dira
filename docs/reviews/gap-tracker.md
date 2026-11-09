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

## 2026-11-09 document-response hardening and CI evidence
- Added `apps/api/tests/document-response.test.ts` first, then `apps/api/src/lib/document-response.ts`, and changed `apps/api/src/routes/documents.ts` to serve private documents as `attachment` with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and sanitized filenames. This reduces active content rendering, response-header injection, and browser caching of sensitive procurement attachments. **New tests not yet verified by CI.**
- PR #3 head `102ed714` had GitHub Actions run #23 `42531676298`: completed **failure**, job `128887022466`; steps API returned `[]`, log retrieval returned `BlobNotFound` 404. No reliable failure diagnosis available; do not call CI green or merge. Subsequent document commits trigger a new run; check its outcome next.
- Branch ancestry reconfirmed: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. Connector still has no delete-ref action.
- NEEDS ME remains: historical credential rotation; final plan pricing; jurisdiction-specific reviewed tax settings; Railway/S3/email/legal settings; recover usable CI runner logs. No live billing or money movement authorized.

## 2026-11-09 document test correction and CI recheck
- GitHub Actions run #28 (`42536724327`) for security PR head `b32ecceb` completed **failure**; job `128902539899` also failed. No step-level diagnostic is present in the returned jobs payload; root cause remains unverified.
- Corrected `apps/api/tests/document-response.test.ts` to exercise actual CR/LF, backslash traversal and NUL/tab characters instead of literal escaped text. Commit `24171a2`. This corrects test coverage but does **not** establish a CI pass or fix the unknown runner failure.
- PR #3 remains draft and mergeability `unstable`; no merge or production deployment. Security isolation, approval limits and full global phases remain open.
- NEEDS ME: obtain actionable CI failure logs or restore GitHub runner availability; rotate previously used historical credentials; approve prices and country tax rules; configure Railway/private S3/email and legal review.

## 2026-11-09 Unicode attachment security and CI recheck
- Added regression tests first (`26b2488`) for Unicode right-to-left override and Unicode line separators in download filenames, then stripped Unicode bidi/format controls (`87f3512`) in `safeAttachmentName`. Prevents misleading extensions in browser download dialogs; new tests **not yet verified**.
- PR #3 previous head `7d97e33` had GitHub Actions run #30 `42542006271`: **failure**, job `128918773845`. Steps API returned `[]`; log fetch failed with `BlobNotFound`. Root cause remains unknown; no CI pass claimed for the new commits. Inspect next run and runner availability before merge.
- Branch comparisons reconfirmed `jolems123-patch-1` 0 ahead/10 behind, `uganda-currency` 0 ahead/0 behind main; no branch deletion action exposed.
- NEEDS ME: actionable CI logs/runner access; historical secret rotation; final plan prices and jurisdiction-reviewed tax profiles; Railway, private S3, email and legal sign-off. Security PR stays draft until all critical controls and checks pass. No live payment processing or billing activation.

## 2026-11-09 receipt and CI remediation
- PR #3 head `9e0610e` CI run #33 (`42547236641`) completed **failure**; job `128934755067` failed with no step details in the connector. This is not passing evidence.
- Added failing-first regression for malformed receipt rows where rejected quantity exceeds received quantity (`3a6ffc9`), then clamped net receipt quantities to nonnegative in `invoiceableLines` (`6db3d3d`). This prevents a negative delivered quantity from flowing into invoice previews. Still needs CI confirmation and upstream receipt-validation review.
- Identified and corrected an existing positive PDF upload test fixture whose declared size (2048) differed from its actual six-byte payload, incompatible with the strict payload-length check (`377c55f`). This is a **plausible test failure**, not proven to be the CI root cause because logs remain unavailable.
- NEEDS ME unchanged: historical credential rotation, final plan prices, reviewed country tax profiles, Railway/private S3/email/legal signoff, CI runner logs. No merge, no live billing or money movement.

## 2026-11-09 receipt input enforcement
- Regression tests committed first (`87836c1`), helper (`55532b8`) and API goods-receipt schema validation (`3c6b8b3`): reject rows where rejected quantity exceeds received quantity, including nonfinite/negative values. This closes the gap where downstream invoice arithmetic clamped invalid quantities but persistence could still accept them. **Tests committed; CI verification pending.**
- Previous PR #3 head `e05e3ef` GitHub Actions run #37 `42552688707`: **completed failure**; not passing evidence. Check new head CI before merge.
- NEEDS ME unchanged: historical credential rotation, final plan pricing, reviewed tax profiles, Railway/S3/email/legal sign-off, and usable CI failure logs. No live billing or supplier money movement approved. Security PR remains draft; no merge.

## 2026-11-09 CI test-fixture remediation
- Confirmed a source-level mismatch: `runLifecycle` in `apps/api/tests/lifecycle.test.ts`, `awardedOrder` in `apps/api/tests/repeat-procurement.test.ts`, and the expired-quotation setup in `apps/api/tests/negative.test.ts` attempted to approve a purchase request as the same user that created it. This contradicts the new server-side segregation-of-duties rule and can make the workflows fail before later assertions.
- Created `registerApprover(buyer)` in `apps/api/tests/helpers.ts`, provisioning a separate user and assigning a same-organisation APPROVER membership; updated all three tests to use that actor. Kept `self-approval.test.ts` asserting that a requester is denied. Commits `ee351a2`, `fe78a13`, `2155d1f`, `f591da2`.
- **Verification pending**: this is a confirmed fixture inconsistency, not proof it caused all workflow failures. Latest previously observed GitHub Actions run #40 (42557704863) completed FAILURE; its step list was unavailable and job logs returned BlobNotFound. Do not merge or mark tests as passing without a new successful run.
- Critical tenant scoping and approval policy gaps remain open. No live billing or supplier payments were enabled.
