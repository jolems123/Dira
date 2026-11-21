import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('blank legacy delivery evidence fails closed', () => {
  const items = [{ id: 'line-1', name: 'Supplies', quantity: 5, unitPrice: 10 }];
  const receipt = (receivedQuantity: string | number, rejectedQuantity: string | number) => ({
    kind: 'RECEIPT',
    items: [{ purchaseOrderItemId: 'line-1', orderedQuantity: 5, receivedQuantity, rejectedQuantity }],
  });
  it.each(['', ' ', '\t'])('does not authorize invoicing with blank received quantity %j', value => {
    const result = invoiceableLines({ items, deliveries: [receipt(value, 0)], invoices: [] });
    expect(result.lines[0].quantity).toBe(0);
  });
  it.each(['', ' ', '\t'])('does not authorize invoicing with blank rejected quantity %j', value => {
    const result = invoiceableLines({ items, deliveries: [receipt(5, value)], invoices: [] });
    expect(result.lines[0].quantity).toBe(0);
  });
  it.each(['', ' ', '\t'])('does not authorize invoicing with blank dispatch quantity %j', value => {
    const result = invoiceableLines({ items, deliveries: [{
      kind: 'DISPATCH',
      items: [{ purchaseOrderItemId: 'line-1', orderedQuantity: value, receivedQuantity: 0, rejectedQuantity: 0 }],
    }], invoices: [] });
    expect(result.lines[0].quantity).toBe(0);
  });
  it('preserves valid zero rejection and positive receipt', () => {
    const result = invoiceableLines({ items, deliveries: [receipt(5, 0)], invoices: [] });
    expect(result.lines[0].quantity).toBe(5);
  });
});
