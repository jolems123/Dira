import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('three-way match incomplete historical purchase orders', () => {
  const match = (quantity: number | null | undefined, unitPrice: number | null | undefined) =>
    evaluateThreeWayMatch({
      purchaseOrder: { id: 'po', poNumber: 'PO-1', currency: 'USD', total: 100, items: [{ id: 'line', name: 'Supply', quantity, unitPrice }] },
      receiptItems: [{ purchaseOrderItemId: 'line', receivedQuantity: 10, rejectedQuantity: 0 }],
      invoice: { id: 'inv', invoiceNumber: 'INV-1', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line', description: 'Supply', quantity: 10, unitPrice: 10 }] },
      siblingInvoices: [],
    });

  it.each([null, undefined])('blocks missing PO quantity %s', (value) => {
    const result = match(value, 10);
    expect(result.matched).toBe(false);
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_PO_LINE', severity: 'BLOCKING' })]));
  });

  it.each([null, undefined])('blocks missing PO unit price %s', (value) => {
    const result = match(10, value);
    expect(result.matched).toBe(false);
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_PO_LINE', severity: 'BLOCKING' })]));
  });

  it('does not reject complete valid PO values', () => {
    const result = match(10, 10);
    expect(result.exceptions.some((issue) => issue.code === 'INVALID_PO_LINE')).toBe(false);
  });
});
