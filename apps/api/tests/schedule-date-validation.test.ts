import { describe, expect, it } from 'vitest';
import { addDays } from '../src/lib/procurement-rules';

describe('procurement schedule date safety', () => {
  it('rejects non-finite and fractional day offsets', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    for (const days of [NaN, Infinity, -Infinity, 0.5]) {
      expect(() => addDays(date, days)).toThrow(RangeError);
    }
  });

  it('rejects invalid source dates and overflowing dates', () => {
    expect(() => addDays(new Date(NaN), 1)).toThrow(RangeError);
    expect(() => addDays(new Date('2026-01-01T00:00:00.000Z'), Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });

  it('preserves valid UTC timestamps and negative day offsets', () => {
    expect(addDays(new Date('2026-01-02T12:30:00.000Z'), -1).toISOString()).toBe('2026-01-01T12:30:00.000Z');
  });
});
