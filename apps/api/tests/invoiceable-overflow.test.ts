import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('invoiceableLines cumulative overflow', () => {
  it('does not expose nonfinite billable quantities when historical receipt sums overflow', () => {
    const result = invoiceableLines({
      items: [{ id: 'line', name: 'Supply', quantity: 10, unitPrice: 1 }],
      deliveries: [
        { kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity: 1e308, rejectedQuantity: 0 }] },
        { kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity: 1e308, rejectedQuantity: 0 }] },
      ],
      invoices: [],
    });
    expect(Number.isFinite(result.lines[0].deliveredQuantity)).toBe(true);
    expect(result.lines[0].quantity).toBeLessThanOrEqual(10);
  });

  it('does not let cumulative invoiced overflow become an invalid preview value', () => {
    const result = invoiceableLines({
      items: [{ id: 'line', name: 'Supply', quantity: 10, unitPrice: 1 }],
      deliveries: [{ kind: 'DISPATCH', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 }] }],
      invoices: [
        { status: 'SUBMITTED', items: [{ purchaseOrderItemId: 'line', quantity: 1e308 }] },
        { status: 'SUBMITTED', items: [{ purchaseOrderItemId: 'line', quantity: 1e308 }] },
      ],
    });
    expect(Number.isFinite(result.lines[0].invoicedQuantity)).toBe(true);
    expect(result.lines[0].quantity).toBe(0);
  });
});
