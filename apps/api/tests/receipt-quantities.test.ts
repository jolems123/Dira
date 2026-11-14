import { describe, expect, it } from 'vitest';
import { validReceiptQuantities } from '../src/lib/receipt-quantities';

describe('goods receipt quantity validation', () => {
  it('rejects rejected quantities larger than received', () => {
    expect(validReceiptQuantities({ receivedQuantity: 2, rejectedQuantity: 3 })).toBe(false);
  });
  it('accepts all rejected or partially rejected receipts', () => {
    expect(validReceiptQuantities({ receivedQuantity: 3, rejectedQuantity: 3 })).toBe(true);
    expect(validReceiptQuantities({ receivedQuantity: 3, rejectedQuantity: 1 })).toBe(true);
  });
  it('rejects non-finite and negative values', () => {
    expect(validReceiptQuantities({ receivedQuantity: Infinity, rejectedQuantity: 0 })).toBe(false);
    expect(validReceiptQuantities({ receivedQuantity: -1, rejectedQuantity: 0 })).toBe(false);
  });
});
