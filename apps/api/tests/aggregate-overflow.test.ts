import { describe, expect, it } from 'vitest';
import { calculateTotals } from '../src/lib/procurement-rules';

describe('procurement aggregate overflow integrity', () => {
  it('rejects finite line inputs whose extended price exceeds safe numeric output', () => {
    expect(() => calculateTotals({ lines: [{ quantity: 1e200, unitPrice: 1e200 }] })).toThrow(RangeError);
  });

  it('rejects a finite delivery charge that exceeds safe numeric output', () => {
    expect(() => calculateTotals({ lines: [], deliveryFee: 1e200 })).toThrow(RangeError);
  });

  it('continues to accept normal small amounts', () => {
    expect(calculateTotals({ lines: [{ quantity: 2, unitPrice: 12.5 }] }).subtotal).toBe(25);
  });
});
