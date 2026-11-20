import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

const fixture = () => ({
  items: [{ id: 'line', name: 'Item', quantity: 5, unitPrice: 12 as number | string }],
  deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 5, receivedQuantity: 5, rejectedQuantity: 0 }] }],
  invoices: [],
});

describe('historical PO price evidence', () => {
  it.each(['', ' ', '\t'])('does not authorize billing when unit price is blank (%j)', (blank) => {
    const data = fixture();
    data.items[0].unitPrice = blank;
    expect(invoiceableLines(data).lines[0].quantity).toBe(0);
  });
  it('allows a genuine numeric zero-price line', () => {
    const data = fixture();
    data.items[0].unitPrice = 0;
    expect(invoiceableLines(data).lines[0].quantity).toBe(5);
  });
});
