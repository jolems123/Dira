import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('blank historical invoice quantity evidence', () => {
  const base = {
    items: [{ id: 'po-line', name: 'Item', quantity: 5, unitPrice: 10 }],
    deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'po-line', orderedQuantity: 5, receivedQuantity: 5, rejectedQuantity: 0 }] }],
  };
  it.each(['', '  ', '\t'])('quarantines blank invoice quantity %j instead of treating it as zero', quantity => {
    const result = invoiceableLines({
      ...base,
      invoices: [{ status: 'APPROVED', items: [{ purchaseOrderItemId: 'po-line', quantity }] }],
    });
    expect(result.lines[0].quantity).toBe(0);
  });
  it('preserves genuine numeric zero invoice quantity', () => {
    const result = invoiceableLines({
      ...base,
      invoices: [{ status: 'APPROVED', items: [{ purchaseOrderItemId: 'po-line', quantity: 0 }] }],
    });
    expect(result.lines[0].quantity).toBe(5);
  });
});
