import crypto from 'node:crypto';

const VERIFICATION_TTL_MS = 60 * 60 * 1000;

/** Generate a bearer credential; persist only tokenHash, never the plaintext token. */
export function createEmailVerificationCredential(now: Date = new Date()) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash, expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS) };
}

/** The caller must also atomically mark a credential consumed in persistent storage. */
export function isEmailVerificationCredentialCurrent(expiresAt: Date, usedAt: Date | null, now: Date = new Date()) {
  return usedAt === null && Number.isFinite(expiresAt.getTime()) && Number.isFinite(now.getTime()) && expiresAt.getTime() > now.getTime();
}
