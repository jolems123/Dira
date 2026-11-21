import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('duplicate historical purchase-order line identifiers', () => {
  const delivery = [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'same-id', orderedQuantity: 5, receivedQuantity: 5, rejectedQuantity: 0 }] }];
  it('does not offer either duplicated PO row for invoicing', () => {
    const result = invoiceableLines({
      items: [
        { id: 'same-id', name: 'First', quantity: 5, unitPrice: 10 },
        { id: 'same-id', name: 'Second', quantity: 5, unitPrice: 10 },
      ],
      deliveries: delivery,
      invoices: [],
    });
    expect(result.lines).toHaveLength(2);
    expect(result.lines.map(line => line.quantity)).toEqual([0, 0]);
  });
  it('continues to invoice distinct PO rows normally', () => {
    const result = invoiceableLines({
      items: [{ id: 'same-id', name: 'First', quantity: 5, unitPrice: 10 }],
      deliveries: delivery,
      invoices: [],
    });
    expect(result.lines[0].quantity).toBe(5);
  });
});
