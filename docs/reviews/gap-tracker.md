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

## 2026-11-09 runner-level failure triage
- New workflow run #44 (ID `42558284826`) for commit `9156b8e` completed FAILURE. GitHub job `128968811187` started at 03:47:20Z and completed at 03:47:21Z, **with zero recorded steps and an empty runner_name**. The check-run output summary is empty. This is evidence of a failure before any application check actually ran, rather than evidence of a particular failing unit test or compiler error.
- A runner-provisioning/workflow service problem is a plausible explanation, but its root cause is not confirmed. Inspect the GitHub Actions run UI, repository Actions permissions/quota and billing/runner availability; retry after access is restored. Do not weaken tests or mark CI passing to work around a runner-level failure.
- Source-level test-fixture corrections are committed but cannot be certified until a workflow with actual executed steps completes successfully. No merge performed.

## 2026-11-09 independent CI alternative
- User confirmed GitHub account billing issues prevent Actions from scheduling jobs. Previous check jobs returned no runner and zero steps: classify these as CI infrastructure failures, not proven application failures.
- Added `scripts/verify.sh` (`3122fb2`), `.gitlab-ci.yml` (`ee98094`), and `docs/ALTERNATIVE_CI.md` (`fa72521`). The script runs npm ci, Prisma client generation and migrations, typechecking, Vitest, builds and production dependency audit, but only after `CI_DATABASE_URL` and `CI_DATABASE_IS_DISPOSABLE=yes` are supplied and NODE_ENV is non-production.
- Independent bash syntax check: `bash -n scripts/verify.sh` **passed**. Full alternative CI checks **have not run**: the available isolated environment cannot resolve github.com to clone the repository, there is no GitLab runner attached, and no running PostgreSQL/docker service in that environment. The GitLab pipeline requires a mirror/import and an available runner. Never claim green CI based on config or syntax checks.
- Existing self-approval test-fixture corrections still await a full integration run. Do not merge or activate live billing. Track all other open feature/security gaps above.

## 2026-11-09 refresh-cookie hardening
- Regression tests first (`cedfc5c`), safe cookie parser (`9dee392`) and auth integration (`f1df097`): malformed percent-encoded refresh cookies no longer throw into Express error handling; duplicate, empty or oversized cookie credentials fail closed. If a malformed refresh cookie is present, the request cannot fall back to a body credential. **Tests committed, not run** because independent CI runner remains unavailable.
- GitHub Actions is blocked by reported account billing issues; no valid test execution or merge evidence. GitLab alternative configuration is committed but needs a mirror and working runner.
- NEEDS ME: enable a GitLab runner/mirror or restore GitHub billing; rotate historical credentials; approve plan prices and jurisdiction-specific tax rules; provide Railway/private S3/email/legal sign-off. Keep PR #3 draft; all five phases are not complete.

## 2026-11-09 password-reset race hardening
- Confirmed `/auth/reset-password` previously read an unused token, then updated the password and marked the token used without an atomic conditional claim. Two concurrent requests could both pass the initial read and both change the password.
- Added tests first (`ddf8d24`) for rejected duplicate claims and successful one-time claim; implemented conditional `updateMany` on `id`, `usedAt: null`, `expiresAt > now` inside a Prisma transaction (`96b326d`), and integrated into the route (`2aec918`). Only a successful claim changes password and revokes sessions. The transaction rolls back if the password update fails.
- Tests are committed but **NOT RUN**. GitHub Actions run `42569023510` for test commit `ddf8d24` ended FAILURE before useful test evidence was available. New commits require a fresh CI run and independent runner. Do not merge.
- Rechecked branches: `jolems123-patch-1` remains 0 ahead/10 behind main; `uganda-currency` remains identical. No supported ref-deletion action identified, so neither deleted.
- NEEDS ME: restore GitHub Actions billing or provision a GitLab mirror/runner for the committed alternative CI; rotate historically exposed credentials; provide final prices, country-specific tax rules, Railway/S3/email settings and legal review. Do not enable live subscription billing or supplier payments.

## 2026-11-09 refresh-cookie production logout hardening
- Read README, positioning, tracker, open PRs and current Actions state. PR #3 remains the sole open PR, draft, mergeability unstable. Latest inspected run `42569053844` completed FAILURE with job `129001954259` and no step details; billing/runner blocker is not proof of test failure or test success.
- Wrote `apps/api/tests/refresh-cookie-flags.test.ts` first (`9e8d894`), then implemented shared secure cookie issuance/clearing helpers (`f8fef23`) and integrated them into auth/logout (`0a757eb`). Previously production logout cleared the cookie without its `Secure` attribute; now clearing matches issuance. **Tests are committed, not run/passed.**
- Rechecked ancestry against main: `jolems123-patch-1` 0 ahead, 10 behind; `uganda-currency` 0 ahead, 0 behind. Deletion not performed because no supported delete-ref action is available.
- NEEDS ME: functioning alternative CI runner or restored GitHub Actions billing; rotated historical credentials; owner-approved prices and reviewed country tax profiles; Railway, private S3, email and legal sign-off. No live supplier payment processing or subscription billing enabled.
- Critical tenant isolation and approval enforcement remain OPEN. Do not merge PR #3 until verified security gates and reviews pass.

## 2026-11-09 receipt quantity safety follow-up
- Added negative-quantity regression cases before implementation (`6cdfb13`); clamped negative received/rejected, dispatched and invoiced quantities in `invoiceableLines` (`9a531bb`). This protects the computed invoiceable quantity but does not replace endpoint-level input validation. **NOT VERIFIED**: GitHub Actions most recent checked run `42575274123` concluded failure with zero executed job steps, consistent with runner/billing blockage. Alternative runner not executed; no passing claim.
- NEEDS ME: restore an accessible independent CI runner (GitLab import/mirror or other runner), disposable PostgreSQL and release environment; confirm pricing, country tax/legal rules, Paddle sandbox credentials, private storage, email domain and production secrets rotation. No live billing or supplier payments enabled.

## 2026-11-09 no-paid-CI engineering continuation
- Owner reports GitHub Actions unavailable due to GitHub billing; do not interpret no-runner failures as application/test results. The owner requested avoiding paid CI. Keep release gates intact and pursue isolated alternative checks if a runner and dedicated disposable database become available.
- Added precision-regression test cases first (`e18297d`) in `apps/api/tests/rules.test.ts`, then changed `round2` and `calculateTotals` to decimal arithmetic using Prisma.Decimal (`e197b81`). This addresses binary `toFixed` rounding and floating-point summation for procure-to-pay totals. **Not yet verified by the repository test suite or typecheck**. Uganda VAT remains the legacy default; global tax configuration is still OPEN.
- The isolated local container cannot resolve github.com; it cannot clone the private repository to execute the actual test suite. No paid GitHub Actions checks were relied upon and no passing build/test or merge is claimed.
- NEEDS ME remains: independent build runner or accessible repository checkout with a disposable PostgreSQL database, final plan prices, country tax compliance review, production environment and secret rotation, Railway/S3/email configuration, and legal approval.

## 2026-11-09 12:11 EAT — approval concurrency hardening
- Read README, product positioning, tracker and open PRs. PR #3 is still the sole open PR and remains draft.
- Confirmed race in `apps/api/src/routes/procurement.ts`: concurrent approve/reject calls previously read SUBMITTED and could both insert final decisions before unconditional updates. Added regression tests first (`81c2bfe`), a scoped compare-and-swap helper (`fb35adf`), and transactional route integration (`58682f1`). Only one request may transition SUBMITTED to APPROVED or REJECTED; losing contenders receive HTTP 409. Decision insert is inside the same transaction as the state claim.
- **Not verified**: tests/typecheck/database integration could not run. Need disposable PostgreSQL and accessible independent runner. In particular validate concurrent approve/reject under real PostgreSQL transactions before merging.
- GitHub Actions run 42591529302 at head `fb35adf` failed; job 129074032643 reports failure with no steps/logs. This is not evidence of a test failure or pass. Billing limitation persists; do not disable required release gates.
- Fresh compare: `jolems123-patch-1` is 0 ahead/10 behind main; `uganda-currency` is 0 ahead/0 behind. No branch deletion capability available. Neither deleted.
- NEEDS ME: an accessible isolated test runner with disposable PostgreSQL, security review/tenant isolation verification, PO approval thresholds, global tax rules, final plan prices, Paddle sandbox credentials (never live), Railway/S3/email configuration, privacy/legal review and rotation of any reused secrets.
- No merge: security PR remains draft with critical unverified items. No shared database changes, no live billing and no supplier money movement.

## 2026-11-09 rejection segregation-of-duties hardening
- Reviewed README.md, docs/POSITIONING.md, this tracker, PR #3, and procurement approval/rejection routes. Confirmed a requester was forbidden from approving their own request but could reject it under OWNER/ADMIN/PROCUREMENT role.
- Wrote a failing-case integration regression first (`0aff6dc`) in `apps/api/tests/self-approval.test.ts`, then added the matching requester prohibition to the rejection endpoint (`895db2a`). Both approval and rejection now return 403 when `requestedBy` equals the acting user. **Committed but not verified by running the test suite**; retain IN PROGRESS.
- GitHub Actions run `42596881428` on test-first commit completed FAILURE; this does not demonstrate the implementation passed. User reported GitHub billing prevents normal CI. No external runner has supplied passing evidence.
- Rechecked branch ancestry using compare API: `jolems123-patch-1` is 0 ahead / 10 behind main; `uganda-currency` is 0 ahead / 0 behind. Neither has unique commits. No supported delete-ref operation is available.
- PR #3 remains draft. No merge or production changes. NEEDS ME: accessible independent runner and disposable PostgreSQL for typecheck/integration/build, review of tenant isolation and approval thresholds, owner-approved subscription prices, country tax rules, production configuration, credential rotation and legal review.

## 2026-11-09 13:48 EAT — submission race hardening
- Read README, positioning, tracker, PR list and procurement route. Only open PR is draft security PR #3.
- Tests-first commit `06b0380` asserts a draft-only, organisation-scoped atomic submission claim; implementation `b82784e`; route integration `03d3308`. The submission endpoint now rejects concurrent/stale submission claims with HTTP 409 rather than blindly updating a previously read DRAFT. **Unit and database tests NOT RUN; change not verified.**
- Latest checked Actions run `42596918377` completed failure with one failed job and **zero steps**. This provides no application test evidence. Owner reports GitHub billing issues; do not disable branch protections or claim green.
- Rechecked branches via compare API: `jolems123-patch-1` ahead 0/behind 10; `uganda-currency` ahead 0/behind 0. Both have no unique commits; deletion action remains unavailable.
- NEEDS ME: accessible independent runner and disposable PostgreSQL for typecheck/unit/integration/security tests; final pricing and tax/legal approvals; production S3, Railway and email settings; credential rotation. Security PR remains draft and unmerged; no live supplier payment or subscription billing enabled.

## 2026-11-09 draft ownership enforcement
- Read README, positioning, tracker and open PRs. Found that `POST /purchase-requests/:id/submit` accepted another active organisation member's draft, even though it checked tenant and draft status. Added regression tests first (`71b731b`), then `maySubmitPurchaseRequest` (`248c4cc`) and a route-level 403 ownership check (`de511a5`). This is **committed, not executed or verified**; a real PostgreSQL route test and typecheck remain necessary.
- GitHub Actions latest observed run `42604163848` for head `478897f`: completed FAILURE. No evidence that new commits passed; owner reports runner billing restrictions. Do not bypass required checks or merge draft PR #3.
- Rechecked main comparisons: `jolems123-patch-1` ahead 0 / behind 10, `uganda-currency` ahead 0 / behind 0. Deletion unsupported by available connector; left intact.
- NEEDS ME: executable independent test runner with disposable PostgreSQL; production secret rotation; final pricing, reviewed country tax profiles, Paddle sandbox merchant credentials, Railway/private S3/email setup, legal review. All other tracker gaps remain open as indicated. Live supplier payments and subscription billing remain disabled.

## 2026-11-09 — three-way-match fail-closed validation
- Regression tests committed first (`3ffe15a`) for receipt rejection greater than receipt quantity and negative/nonfinite invoice line quantities.
- Implementation (`9473dbd`) adds BLOCKING `INVALID_RECEIPT_QUANTITY` and `INVALID_INVOICE_QUANTITY` exceptions to three-way matching and excludes invalid receipt/invoice lines from trusted aggregates. This closes a gap between receipt input validation and invoice matching, but requires integration tests to establish route-level enforcement.
- Verification: latest inspected pre-change GitHub Actions run `42611303806` failed with job `checks` and **zero steps**; not an application-test result. Full suite, PostgreSQL concurrency, route authorization and E2E checks **NOT RUN**. PR #3 remains draft and unmerged.
- Branch ancestry rechecked via compare API: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. Connector does not expose deletion.
- NEEDS ME: functioning isolated test runner with disposable PostgreSQL, tenant-isolation and approval-policy review, country-specific tax rules, final plan prices, Paddle sandbox credentials (no live billing), private S3, Railway environment, email domain, legal/privacy review, and rotation of any historical secrets. No production database or live payments touched.

## 2026-11-09 16:52 EAT — mixed partial receipts
- Read README, positioning, tracker, open PR #3 and procurement rules. Added tests first (`59546ba`) for mixed received/unreceived PO lines and fully rejected receipts; implementation (`ea75a74`) selects receipt-versus-dispatch evidence per PO line, rather than using a single PO-wide receipt flag. This avoids hiding eligible dispatched quantities on unrelated lines when one line has a receipt, while preserving zero-net rejected receipts as authoritative for their own line.
- **NOT VERIFIED**: no executable unit/integration/typecheck evidence. Latest inspected Actions run `42620072191` at `933fbfe` completed FAILURE; job `129169623074` reports failure without step details. This run predates the new commits and cannot verify them. GitHub billing limitation remains; use a non-paid isolated runner with disposable PostgreSQL rather than bypassing checks.
- Ancestry rechecked: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. Both lack unique commits. No supported deletion action identified; neither deleted.
- NEEDS ME: independent test execution and PostgreSQL, tenant-isolation/approval review, historical credential rotation, owner-approved plan prices, reviewed country tax profiles, Paddle **sandbox** credentials, Railway/private S3/email configuration and privacy/legal approval. PR #3 stays draft/unmerged; all remaining launch phases OPEN. No shared DB mutations, live billing or supplier payment processing.

## 2026-11-09 quotation line integrity and CI recheck
- Added regression tests first (`ef2ca11`), uniqueness validation helper (`e95f939`), and quote pricing integration (`bb49124`). Duplicate RFQ item references in a supplier quotation are rejected before totals and persistence, preventing repeated line billing. **Committed, not verified by an executable CI run.**
- Rechecked GitHub Actions run `42620072191`: job `129169623074` completed FAILURE; job response exposes no steps or logs. This is not evidence that application tests ran. Inspect the next run for the new head and restore a usable runner before merging.
- Branch ancestry: `jolems123-patch-1` 0 ahead/10 behind `main`; `uganda-currency` 0 ahead/0 behind. Both have no unique commits; no supported ref-deletion action exposed.
- NEEDS ME: restore GitHub Actions billing/runner or provision the alternative CI runner; rotate historical credentials; approve final plan prices and reviewed country tax rules; configure Railway/private S3/email and complete legal review. Do not activate live billing or supplier payments.
- Security PR #3 remains draft and unmerged; tenant isolation, approval limits, and all remaining global launch phases need executable verification and implementation.


## 2026-11-09 18:48 EAT — cross-PO line reference enforcement
- Reviewed README, positioning, tracker and sole open draft PR #3. Security head before this run `6c8eaea` had GitHub Actions run #90 (`42638439206`) **completed FAILURE**, job `129232739726`; job response has no steps or logs. No test pass or diagnosed application failure can be claimed.
- Wrote regression tests first (`23fe628`) for an invoice line or goods receipt referencing a PO item ID not belonging to the matched purchase order. Then updated three-way matching (`629e091`) to produce BLOCKING `UNMATCHED_INVOICE_LINE` / `UNMATCHED_RECEIPT_LINE` exceptions, excluding those foreign references from trusted aggregates. This closes a fail-open case where unknown linked invoice lines were silently omitted. **Committed, NOT executed or independently verified.**
- Fresh ancestry compare: `jolems123-patch-1` 0 ahead/10 behind main, `uganda-currency` 0 ahead/0 behind. Neither contains unique commits; no supported delete-ref capability identified. Neither deleted.
- NEEDS ME: independent runner with disposable PostgreSQL for test/typecheck/build and real tenant-isolation/approval tests; actionable CI logs or restored runner access; historical credential rotation; owner-approved final plan prices and jurisdiction-reviewed tax profiles; Paddle sandbox, Railway/private S3/email and privacy/legal sign-off. Do not activate live subscription billing or supplier payments.
- PR #3 remains draft/unmerged pending critical security work and executable verification. Remaining global phases OPEN. No shared DB changes or protection bypass.

## 2026-11-09 duplicate delivery-line validation and verification recheck
- Regression tests committed first (`25ec0c1`), helper (`1d59dad`), and dispatch/receipt Zod enforcement (`b944e68`). Duplicate purchase-order item IDs within a single dispatch or goods receipt now fail request validation rather than being double-counted. Tests **not executed independently**; do not mark FIXED.
- Security PR #3 prior head `8615d411` had `Dira checks` run `42648542071` (#93) completed **failure**; job `129268304066` reported failure with no step summaries, and logs could not be retrieved through the connector. Root cause unknown. New commits have not been verified.
- Rechecked branch ancestry: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. No supported branch deletion action. PR #3 remains draft and unmerged.
- NEEDS ME: restore actionable CI/runner logs or independently run tests against disposable PostgreSQL; rotate historically exposed credentials; approve plan prices and reviewed country tax rules; configure Railway/private S3/email; obtain privacy/legal signoff. Do not enable supplier money movement or live Paddle billing.

## 2026-11-09 20:45 EAT — unlinked goods receipt evidence
- Read README.md, docs/POSITIONING.md, this tracker, and the sole open draft PR #3. Identified a fail-open three-way-match case: a receipt without a purchase-order-item reference increased `totalReceived` and could suppress `MISSING_RECEIPT`, despite not verifying any ordered line.
- Regression committed first (`edc3c66`), then implementation (`11b0302`). Unlinked receipts now raise BLOCKING `UNMATCHED_RECEIPT_LINE` and cannot count as trusted receipt evidence. **Tests not executed; not verified.** Preserve security gap IN PROGRESS.
- Previous PR head `85a337b` has GitHub Actions run #96 (`42657688097`) completed FAILURE; job `129300507918` exposes no steps. New head had no returned workflow run at check time. Do not claim a passing check or merge.
- Fresh ancestry compare: `jolems123-patch-1` 0 ahead/10 behind main; `uganda-currency` 0 ahead/0 behind. Both have no unique commits, but GitHub connector has no branch-ref deletion action; neither deleted.
- NEEDS ME: independent executable CI with disposable PostgreSQL and usable failure logs; full tenant isolation and approval policy review; rotate any historical secrets; approve final prices and jurisdictional tax profiles; Paddle sandbox credentials; Railway/private S3/email and privacy/legal sign-off. No production DB writes, live supplier payments, or live subscription billing. PR #3 remains draft and unmerged; phases 2–5 remain OPEN.

## 2026-11-09 21:42 EAT — nonfinite historical quantity hardening
- Reviewed README.md, docs/POSITIONING.md, tracker and the sole open draft PR #3. CI run #99 `42667932449` at prior head `f5a23db` concluded FAILURE; job `129336470717` returned zero steps and logs returned BlobNotFound. This provides no executable test evidence.
- Tests-first commit `97942b7` covers NaN/positive/negative infinity in legacy receipt quantities. Implementation `facba3b` sanitizes nonfinite receipt, dispatch and invoiced quantities in invoiceable-line calculations to zero instead of exposing nonfinite billable values. **NOT EXECUTED OR VERIFIED**; must run unit tests, typecheck, and integration tests on an isolated runner before acceptance.
- Fresh compare confirms `jolems123-patch-1` 0 ahead/10 behind main and `uganda-currency` identical to main. Both have no unique commits; no supported ref deletion action available.
- NEEDS ME: independent test runner with disposable PostgreSQL or restored GitHub Actions access; complete tenant isolation and approval thresholds; rotate historical credentials; owner-approved plan prices and country-reviewed tax rules; Paddle sandbox credentials, Railway/private S3/email configuration and privacy/legal sign-off.
- PR #3 remains draft and unmerged. No shared database changes, live supplier payments, live subscription billing or protection bypass. Global phases 2–5 remain open.

## 2026-11-09 22:44 EAT — conflicting invoice unit prices
- Read README.md, docs/POSITIONING.md, tracker, and open PRs; PR #3 remains the sole open PR. Found that repeated invoice lines for one PO item overwrite the aggregate unit price with the final line's price. A higher-priced earlier line could therefore evade line-level PO price comparison when the last line matches the PO price.
- Committed regression first (`497a58a`) and fail-closed matcher change (`a06e237`): conflicting unit prices for the same PO item now produce BLOCKING `CONFLICTING_INVOICE_PRICES`, excluding the conflicting line from trusted aggregates. **Not executed or verified**; a test runner, typecheck and integration evidence are still required.
- Current implementation head `a06e237` returned no workflow runs on recheck. Previously recorded GitHub Actions run `42667932449` concluded FAILURE (job `129336470717`, no step evidence). Do not attribute that older failure to these commits or claim passing checks.
- Compare API: `jolems123-patch-1` is 0 ahead/10 behind main; `uganda-currency` is identical to main. Neither has unique commits; no supported delete-ref tool is exposed, so neither was deleted.
- **NEEDS ME:** independent executable runner with disposable PostgreSQL or restored CI; complete tenant isolation, approval thresholds and security review; historical secret rotation; owner-approved final plan prices, jurisdiction-reviewed tax rules, Paddle sandbox credentials, Railway/private S3/email configuration, and privacy/legal sign-off. Live supplier payment processing and live subscription billing remain disabled.
- PR #3 stays draft and unmerged; phases 2–5 remain open. No shared database changes, force pushes, or protection bypass.

## 2026-11-09 23:44 EAT — independent CI recovery procedure
- Re-read README, global positioning, tracker, open PRs and existing GitHub Actions workflow. The sole open PR is security draft #3; no merge or passing tests established this run.
- Added `docs/reviews/INDEPENDENT_CI.md` in commit `9991a09`: exact isolated PostgreSQL 16 / Node 22 verification commands, provenance and log requirements, and explicit prohibition on bypassing branch protections. Documentation only; **NO TESTS EXECUTED**, and no CI success claimed.
- Fresh ancestry comparison: `jolems123-patch-1` ahead 0/behind 10; `uganda-currency` ahead 0/behind 0. Both have no unique commits; no supported branch deletion action exposed, so left intact.
- **NEEDS ME:** restore paid GitHub Actions eligibility or provide an approved independent runner/check integration; independently run tests, tenant isolation, approval and concurrency suites on disposable PostgreSQL; rotate historical secrets; approve country tax rules, plan prices and Paddle sandbox configuration; provide Railway/private S3/email and privacy/legal sign-off. PR #3 remains draft/unmerged and phases 2–5 OPEN. No live billing, supplier payment processing or shared DB mutation.

## 2026-11-10 00:46 EAT — cumulative receipt overage protection
- Read README.md, docs/POSITIONING.md, this tracker, and the sole open PR #3. Source review found that cumulative net receipts exceeding ordered quantities were not independently flagged when the invoice quantity itself remained within the PO quantity.
- Added failing-first regression test `apps/api/tests/over-receipt.test.ts` (commit `3b507d0`), then added blocking `OVER_RECEIPT` exception in `evaluateThreeWayMatch` (commit `57dba5f`). This rejects aggregated over-receipt evidence even when the invoice is otherwise matched. **Committed, not executed or verified**.
- Workflow lookup for implementation head `57dba5f` returned no PR-triggered runs. Do not infer passing checks or merge. GitHub Actions billing/runner issue and independent disposable-PostgreSQL runner remain blockers.
- Branch ancestry rechecked using GitHub compare API: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. Both have no unique commits; no supported branch deletion tool, neither deleted.
- **NEEDS ME:** runnable independent CI with disposable PostgreSQL, critical tenant isolation and approval review, historical credential rotation, owner-approved plan prices, jurisdiction-reviewed tax rules, Paddle sandbox credentials, Railway/private S3/email setup, and privacy/legal approval. Security PR #3 remains draft/unmerged; phases 2–5 OPEN. No production DB mutations, live supplier payments, or live subscription billing.


## 2026-11-10 — malformed purchase-order matching guard
- Read README on main, positioning and tracker on security branch, and open PRs. Only open PR found: security PR #3. `docs/POSITIONING.md` does not exist on main; it exists on `fix/dira-security`.
- Added regression tests first (`16ee47f`) for NaN, negative and infinite PO quantities/prices; implementation (`00f67a3`) adds a BLOCKING `INVALID_PO_LINE` exception and finite nonnegative fallback values in three-way-match line output. This prevents malformed historical PO lines from silently matching. **Committed but NOT EXECUTED, typechecked, or independently verified.** Keep security IN PROGRESS.
- Workflow lookup for prior tracker commit `aa12a81` returned zero pull-request workflow runs; this endpoint only returns PR-triggered runs and is not evidence of success. Owner-reported GitHub Actions billing/runner limitation persists. Do not merge PR #3 or claim CI green.
- Fresh compare with main: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. Both contain no unique commits; no supported delete-ref tool exposed, so neither deleted.
- **NEEDS ME (current):** functioning isolated CI runner with disposable PostgreSQL and test/typecheck/build evidence; complete cross-tenant and approval-limit security review; rotate historical credentials; approve final pricing and jurisdiction-specific tax rules; Paddle sandbox account, Railway/private S3/email settings, and legal/privacy sign-off. No live supplier money movement or live subscription billing authorised.
- Phase 1 remains draft and unmerged; phases 2–5 remain OPEN. No production DB changes, force pushes, or branch-protection bypass.

## 2026-11-10 CI and release-gate recheck
- Read README.md, docs/POSITIONING.md, this tracker, and open PR search. Only PR #3 is open; it remains draft, head `8360f736ecaf4a4c12f07ac6cfb200ed660ca5bf`, not merged. No phase is accepted as complete.
- GitHub Actions `Dira checks` run #113 (`42715345357`) for that head completed **FAILURE**; job `129495305503` reports failure with no step details in the job summary. This is not evidence that application tests ran. No successful tests, build, or merge claimed this run.
- Fresh compare API: `jolems123-patch-1` 0 ahead/10 behind main, `uganda-currency` 0 ahead/0 behind. No unique commits; no supported branch deletion action available, so neither deleted.
- Source review: `evaluateThreeWayMatch` uses Number arithmetic in subtotal and total checks and `resolveTax` still defaults to Uganda VAT; country-specific tax profiles and malformed historical invoice total handling require regression tests and independent verification before production. Do not infer global finance readiness from the existing Decimal-based `calculateTotals` helper.
- NEEDS ME: working no-paid-CI runner with isolated disposable PostgreSQL (or restored Actions quota), actionable job logs, historical credential rotation, owner-approved plan prices and reviewed country tax profiles, Paddle **sandbox-only** credentials, Railway/private S3/email configuration and legal/privacy approval. Never enable live billing without explicit approval; supplier payments remain records only.


## 2026-11-10 financial integrity and verification
- Security PR #3 previous head `26fd8ff`: GitHub Actions run #114 (`42723039964`) completed FAILURE. This is not passing evidence.
- Regression tests committed first (`3a4300f`), then fail-closed legacy PO/invoice total validation (`ce6482f`): reject negative/nonfinite PO totals and invoice total/subtotal/tax, and prevent nonfinite document totals from entering returned match summary. **Tests not executed or independently verified.**
- Rechecked branch ancestry: `jolems123-patch-1` 0 ahead/10 behind main; `uganda-currency` 0 ahead/0 behind. No supported branch deletion action available.
- NEEDS ME: restore an executable CI runner with disposable PostgreSQL; rotate any historically exposed credentials; approve jurisdiction-reviewed tax rules and plan prices; configure Paddle **sandbox only**, Railway/private S3/email; obtain privacy/legal approval. Do not merge draft PR #3 until required tests and reviews pass. Supplier payments remain records only; no live subscription billing approval.


## 2026-11-10 04:45 EAT — duplicate PO item ID guard and CI recheck
- Read README on main, positioning and tracker on security branch, and searched open PRs. Only open PR is security draft #3. Positioning is not on main.
- Added regression test first in `apps/api/tests/duplicate-po-line.test.ts` (commit `f0761de`), then updated `evaluateThreeWayMatch` to raise BLOCKING `DUPLICATE_PO_LINE` when a historical or malformed purchase order contains repeated item IDs (commit `2cfb1c3`). Duplicate identifiers make receipt/invoice evidence ambiguous. **Tests NOT EXECUTED or independently verified**; do not mark this fixed or merge.
- Workflow lookup for prior head `efa56e5` returned no pull-request-triggered runs; this is not passing CI evidence. Prior documented GitHub Actions run #114 (`42723039964`) failed without useful executed-step evidence. GitHub billing/runner access remains unresolved.
- Rechecked ancestry via compare API: `jolems123-patch-1` 0 ahead/10 behind main; `uganda-currency` 0 ahead/0 behind. Neither has unique commits. No supported branch deletion action exposed; neither deleted.
- **NEEDS ME:** isolated executable CI runner with disposable PostgreSQL for full tests, typechecks and builds; critical tenant isolation and approval policy review; historical credential rotation; approved prices and jurisdiction-reviewed tax rules; Paddle sandbox credentials, Railway/private S3/email configuration, and legal/privacy approval.
- Security PR #3 remains draft and unmerged; phases 2–5 remain OPEN. No shared database operations, force pushes, live supplier payments or live subscription billing.

## 2026-11-10 invoice-preview integrity and verification
- Regression test committed first (`e792233`), then invoice-preview fail-closed change (`b016299`): malformed historical PO quantity/unit price (NaN, infinity, negative) now render as zero instead of propagating invalid numbers to the supplier invoiceable-line preview. These commits are **not verified by executable tests**. This is defense in depth, not a substitute for rejecting invalid records at creation.
- Latest observed GitHub Actions run #120 (`42738176135`) for preceding head `67a0c88` completed FAILURE. Job `129572436158` started 01:46:45Z and ended 01:46:46Z with `steps: []`, `runner_id: 0` and empty runner name; no application test executed. Investigate GitHub Actions billing/runner provisioning or run independent disposable-Postgres verification. No check bypass or merge.
- Branch compare: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. No supported delete-ref tool available; neither deleted.
- **NEEDS ME (still open):** independent runnable CI and disposable PostgreSQL; historical credential rotation; approved prices and country tax rules; Paddle sandbox credentials (no live activation); Railway/private S3/email setup; legal/privacy sign-off. Security tenant isolation and approval limits remain critical open blockers. All five phases remain unmerged.


## 2026-11-10 06:48 EAT — invoice subtotal overflow hardening
- Re-read README.md (main), docs/POSITIONING.md and this tracker (security branch), and open PR search; sole open PR is security #3. Rechecked branch ancestry: `jolems123-patch-1` ahead 0/behind 10; `uganda-currency` identical to main. Neither deleted: connector exposes no ref-deletion operation.
- Source review identified a second-order arithmetic issue: invoice line quantity and price can each be finite while their product overflows to Infinity; the previous `Math.abs(computedSubtotal - declaredSubtotal) > MONEY_EPSILON` condition is unreliable for NaN. Added regression tests first (`7b85c2b`) then changed the matcher (`958064f`) to use Decimal aggregation, reject invalid/overflowing arithmetic with BLOCKING `INVALID_INVOICE_SUBTOTAL`, and return finite derived subtotal for comparison. **Commits created; tests/typecheck/build NOT EXECUTED or independently verified.**
- Workflow lookups for `b016299` and implementation `958064f` returned zero PR-triggered runs; this is not a CI pass. Previous recorded run #120 failed before any steps with runner_id 0. Do not bypass branch protection or merge draft PR #3.
- **NEEDS ME:** executable isolated runner and disposable PostgreSQL; tenant isolation/approval threshold verification; rotate any historical credentials; approve plan pricing and jurisdiction-reviewed taxes; Paddle sandbox credentials; Railway/private S3/email configuration and privacy/legal sign-off. Phases 2–5 remain OPEN; no production DB changes, live supplier payments, live billing or force pushes.

## 2026-11-10 07:43 EAT — cumulative invoice preview overflow
- Re-read main README, security-branch positioning/tracker, open PR search, and the invoice preview implementation. Only open PR is draft security #3; positioning exists only on security branch.
- Added failing-first regression cases in `apps/api/tests/invoiceable-overflow.test.ts` (commit `e7daff1`), then capped receipt, dispatch and invoice preview aggregates at `Number.MAX_SAFE_INTEGER` in `invoiceableLines` (commit `4ba7c25`). This prevents individually finite historical quantities from summing to Infinity and propagating nonfinite supplier preview values. The cap is defensive presentation logic; invalid historical records still require upstream audit/repair. **Tests NOT EXECUTED; no typecheck/build pass claimed.**
- Workflow lookup for prior tracker head `44a6d7d` returned zero PR-triggered runs. This is not successful CI evidence; previous run #120 failed before executing steps. Keep PR #3 draft and unmerged until independent verification and critical authorization review.
- Fresh compare: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` identical to main. Neither deleted because no supported delete-ref operation is exposed.
- **NEEDS ME:** runnable isolated verification with disposable PostgreSQL; critical tenant/approval security review; historical credential rotation; final plan prices and reviewed country taxes; Paddle sandbox credentials; Railway/private S3/email and privacy/legal sign-off. Do not enable live supplier payments or subscription billing. All five phases remain unmerged.

## 2026-11-10 unknown workflow-state validation and CI review
- Reviewed README.md, docs/POSITIONING.md, open PR #3 and this tracker. PR #3 remains draft and unmerged. Prior head `4bce25f6` has Actions run #129 (ID `42757742249`) **completed FAILURE**; job `129635954608` reports no steps and no log URL, so application test failure is not established. New commits require fresh verification.
- Regression tests added first in `apps/api/tests/transition-unknown-status.test.ts` (`ff0ac942`); implementation in `apps/api/src/lib/procurement-rules.ts` (`d2f80efa`) now rejects unknown source statuses even when source equals target, while preserving valid known no-op and allowed transitions. **Not independently executed or verified.**
- Rechecked branch ancestry against main: `jolems123-patch-1` 0 ahead/10 behind; `uganda-currency` 0 ahead/0 behind. Both contain no unique commits. Connector has no supported delete-ref operation; neither deleted.
- **NEEDS ME:** restore a working executable runner with disposable PostgreSQL and complete tests/build/security audit; rotate any historical credentials; approve plan prices and jurisdiction-specific tax profiles; provide Paddle sandbox, Railway/private S3/email configurations and privacy/legal signoff. No live supplier payments or live subscription billing authorized. Security, global finance, differentiators, billing and release phases remain incomplete; do not merge without required green checks and reviews.

## 2026-11-10 09:48 EAT — aggregate overflow security hardening
- Re-read README.md, docs/POSITIONING.md on the security branch, gap tracker and open PRs. Sole open PR remains security #3; no verified merge.
- Tests-first commit `a9f67f1` adds regression coverage for finite individual receipt/invoice quantities that overflow when aggregated. Implementation `38940f8` raises BLOCKING `INVALID_RECEIPT_AGGREGATE` and `INVALID_INVOICE_AGGREGATE`, and BLOCKING `INVALID_RECEIVED_VALUE` when extended receipt values overflow. It returns finite fallback summaries instead of Infinity. **Tests committed but NOT EXECUTED or independently verified**; further review of all overflow and decimal precision paths remains required.
- Workflow lookup for implementation head `38940f8` returned no PR-triggered runs. Previously observed run #129 (`42757742249`) remains FAILURE; job `129635954608` had no steps or logs URL in the connector. Do not infer a test failure or success.
- Fresh compare confirms `jolems123-patch-1` 0 ahead/10 behind main; `uganda-currency` 0 ahead/0 behind. No supported delete-ref operation found; neither deleted.
- **NEEDS ME:** restore functioning CI or independent runner with disposable PostgreSQL to execute unit/integration tests, typecheck, build and security audit; complete cross-tenant authorization and approval threshold verification; rotate historical secrets; approve pricing and reviewed country tax profiles; supply Paddle sandbox, Railway/private S3/email and privacy/legal approvals. No live subscription billing or supplier payment processing.
- Security PR #3 remains draft/unmerged. Phases 2–5 remain OPEN; no shared database writes, force pushes, or protection bypass.
