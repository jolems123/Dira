/** Central policy for issuing or continuing authenticated sessions.
 * Integrate only alongside a functioning verification/resend flow to avoid
 * stranding newly registered accounts. Never treat missing flags as verified.
 */
export function mayIssueAuthenticatedSession(
  user: { status: string; emailVerified: boolean } | null | undefined,
): boolean {
  return user?.status === 'ACTIVE' && user.emailVerified === true;
}
