import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

const items = [{ id: 'line-1', name: 'Supplies', quantity: 10, unitPrice: 5 }];
const dispatch = { kind: 'DISPATCH', items: [{ purchaseOrderItemId: 'line-1', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 }] };

describe('invalid receipt evidence must not authorize dispatch fallback', () => {
  it.each([null, undefined, -1, Number.NaN])('withholds invoiceable quantity for invalid rejected quantity %s', (rejectedQuantity) => {
    const result = invoiceableLines({ items, deliveries: [dispatch, { kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line-1', orderedQuantity: 10, receivedQuantity: 5, rejectedQuantity }] }], invoices: [] });
    expect(result.lines[0].deliveredQuantity).toBe(0);
    expect(result.lines[0].quantity).toBe(0);
  });
  it('still uses dispatch for lines with no receipt evidence', () => {
    const result = invoiceableLines({ items, deliveries: [dispatch], invoices: [] });
    expect(result.lines[0].quantity).toBe(10);
  });
});
