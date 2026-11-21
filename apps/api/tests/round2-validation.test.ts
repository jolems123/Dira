import { describe, expect, it } from 'vitest';
import { round2 } from '../src/lib/procurement-rules';

describe('round2 monetary output safety', () => {
  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.MAX_VALUE])('rejects invalid or unsafe monetary input %s', (value) => {
    expect(() => round2(value)).toThrow(RangeError);
  });

  it('retains decimal half-up rounding for finite values', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
  });
});
