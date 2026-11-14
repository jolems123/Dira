import { describe, expect, it } from 'vitest';
import { calculateTotals } from '../src/lib/procurement-rules';

describe('procurement discount integrity', () => {
  it('rejects a discount larger than subtotal plus delivery', () => {
    expect(() => calculateTotals({ lines: [{ quantity: 1, unitPrice: 10 }], discount: 10.01 })).toThrow(RangeError);
  });

  it('allows a full discount with a zero total', () => {
    expect(calculateTotals({ lines: [{ quantity: 1, unitPrice: 10 }], discount: 10 }).total).toBe(0);
  });

  it('rejects a discount exceeding an empty document', () => {
    expect(() => calculateTotals({ lines: [], discount: 0.01 })).toThrow(RangeError);
  });
});
