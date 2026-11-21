import { describe, expect, it } from 'vitest';
import { shouldAttemptPasswordResetDelivery } from '../src/lib/password-reset-delivery-policy';

describe('password reset delivery policy', () => {
  it('requires delivery in production and staging even if the runtime label differs', () => {
    expect(shouldAttemptPasswordResetDelivery('production')).toBe(true);
    expect(shouldAttemptPasswordResetDelivery('staging')).toBe(true);
    expect(shouldAttemptPasswordResetDelivery('development')).toBe(true);
  });
  it('only skips external delivery for isolated automated tests', () => {
    expect(shouldAttemptPasswordResetDelivery('test')).toBe(false);
  });
});
