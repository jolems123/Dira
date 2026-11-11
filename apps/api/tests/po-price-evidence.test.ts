import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('historical purchase-order price evidence', () => {
  const delivery = [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line-1', orderedQuantity: 4, receivedQuantity: 4, rejectedQuantity: 0 }] }];
  it.each([null, undefined, Number.NaN, -1])('does not offer invoiceable quantity when unit price is %s', (unitPrice) => {
    const result = invoiceableLines({
      items: [{ id: 'line-1', name: 'Materials', quantity: 4, unitPrice }],
      deliveries: delivery,
      invoices: [],
    });
    expect(result.lines[0].quantity).toBe(0);
  });
  it('preserves a valid zero-priced line', () => {
    const result = invoiceableLines({
      items: [{ id: 'line-1', name: 'Gift', quantity: 4, unitPrice: 0 }],
      deliveries: delivery,
      invoices: [],
    });
    expect(result.lines[0].quantity).toBe(4);
  });
});
