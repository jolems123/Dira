import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('three-way matching over-receipt protection', () => {
  const base = {
    purchaseOrder: { id: 'po-1', poNumber: 'PO-1', currency: 'USD', total: 100, items: [{ id: 'line-1', name: 'Item', quantity: 2, unitPrice: 50 }] },
    invoice: { id: 'inv-1', invoiceNumber: 'INV-1', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line-1', description: 'Item', quantity: 2, unitPrice: 50 }] },
    siblingInvoices: [],
  };
  it('blocks cumulative receipts exceeding the ordered quantity', () => {
    const result = evaluateThreeWayMatch({ ...base, receiptItems: [
      { purchaseOrderItemId: 'line-1', receivedQuantity: 2, rejectedQuantity: 0 },
      { purchaseOrderItemId: 'line-1', receivedQuantity: 1, rejectedQuantity: 0 },
    ] });
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'OVER_RECEIPT', severity: 'BLOCKING' })]));
    expect(result.matched).toBe(false);
  });
  it('allows receipts equal to ordered quantity', () => {
    const result = evaluateThreeWayMatch({ ...base, receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 2, rejectedQuantity: 0 }] });
    expect(result.exceptions.some((e) => e.code === 'OVER_RECEIPT')).toBe(false);
  });
});
