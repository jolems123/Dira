import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('invoiceableLines historical invoice safety', () => {
  const preview = (quantity: number | null | undefined) => invoiceableLines({
    items: [{ id: 'line', name: 'Supply', quantity: 10, unitPrice: 1 }],
    deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity: 10, rejectedQuantity: 0 }] }],
    invoices: [{ status: 'SUBMITTED', items: [{ purchaseOrderItemId: 'line', quantity }] }],
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, null, undefined])('does not release billable capacity for malformed active invoice quantity %s', (quantity) => {
    const result = preview(quantity);
    expect(result.lines[0].quantity).toBe(0);
    expect(Number.isFinite(result.lines[0].invoicedQuantity)).toBe(true);
  });

  it('preserves legitimate remaining quantity for valid active invoices', () => {
    expect(preview(3).lines[0].quantity).toBe(7);
  });
});
