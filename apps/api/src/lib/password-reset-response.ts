/** Identical public response for known, unknown and throttled accounts. */
export function publicPasswordResetResponse(): { message: string } {
  return { message: 'If the account exists, reset instructions will be sent.' };
}
