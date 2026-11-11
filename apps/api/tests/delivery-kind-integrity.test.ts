import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('invoiceableLines delivery kind integrity', () => {
  const items = [{ id: 'po-line', name: 'Supplies', quantity: 10, unitPrice: 5 }];
  const deliveryItem = { purchaseOrderItemId: 'po-line', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 };

  it('does not count an unknown historical delivery kind as dispatch evidence', () => {
    const result = invoiceableLines({
      items,
      deliveries: [{ kind: 'UNRECOGNIZED', items: [deliveryItem] }],
      invoices: [],
    });
    expect(result.lines[0].deliveredQuantity).toBe(0);
    expect(result.lines[0].quantity).toBe(0);
  });

  it('continues to recognize actual dispatch evidence', () => {
    const result = invoiceableLines({
      items,
      deliveries: [{ kind: 'DISPATCH', items: [deliveryItem] }],
      invoices: [],
    });
    expect(result.lines[0].deliveredQuantity).toBe(10);
    expect(result.lines[0].quantity).toBe(10);
  });
});
