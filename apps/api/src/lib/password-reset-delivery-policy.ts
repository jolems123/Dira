/** Only isolated automated tests may omit external password recovery email delivery. */
export function shouldAttemptPasswordResetDelivery(nodeEnv: string): boolean {
  return nodeEnv !== 'test';
}
