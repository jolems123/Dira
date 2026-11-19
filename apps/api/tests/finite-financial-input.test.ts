import { describe, expect, it } from 'vitest';
import { nonnegativeMoney, positiveMoney } from '../src/lib/finite-financial-input';

describe('financial input validation', () => {
  it('rejects Infinity, -Infinity, NaN and negative amounts', () => {
    for (const value of [Infinity, -Infinity, NaN, -1]) {
      expect(nonnegativeMoney.safeParse(value).success).toBe(false);
      expect(positiveMoney.safeParse(value).success).toBe(false);
    }
  });
  it('allows finite zero for nonnegative amounts but not payments', () => {
    expect(nonnegativeMoney.safeParse(0).success).toBe(true);
    expect(positiveMoney.safeParse(0).success).toBe(false);
  });
  it('accepts finite positive amounts', () => {
    expect(nonnegativeMoney.safeParse(12.25).success).toBe(true);
    expect(positiveMoney.safeParse(12.25).success).toBe(true);
  });
});
