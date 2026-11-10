import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('invoiceableLines malformed historical receipts', () => {
  const preview = (receivedQuantity: number, rejectedQuantity: number) =>
    invoiceableLines({
      items: [{ id: 'line', name: 'Supply', quantity: 10, unitPrice: 2 }],
      deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'line', orderedQuantity: 10, receivedQuantity, rejectedQuantity }] }],
      invoices: [],
    }).lines[0];

  it('does not make rejected units billable when rejection is NaN', () => {
    expect(preview(10, Number.NaN).quantity).toBe(0);
  });

  it('does not make rejected units billable when rejection is negative', () => {
    expect(preview(10, -1).quantity).toBe(0);
  });

  it('does not make rejected units billable when rejection exceeds received', () => {
    expect(preview(10, 11).quantity).toBe(0);
  });

  it('retains valid net received quantities', () => {
    expect(preview(10, 3).quantity).toBe(7);
  });
});
