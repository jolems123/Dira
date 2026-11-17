/** Prevent repeated reset requests from replacing still-valid email links.
 * This is a per-account cooldown, not a substitute for IP/edge rate limiting.
 */
export function mayIssuePasswordReset(latest: { createdAt: Date } | null, now: Date, cooldownMs = 60_000): boolean {
  if (!latest) return true;
  const elapsed = now.getTime() - latest.createdAt.getTime();
  return Number.isFinite(elapsed) && elapsed >= cooldownMs;
}
