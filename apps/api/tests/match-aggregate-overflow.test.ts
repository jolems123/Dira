import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('three-way match aggregate overflow', () => {
  const base = {
    purchaseOrder: { id: 'po', poNumber: 'PO', currency: 'USD', total: 100, items: [{ id: 'line', name: 'Line', quantity: 2, unitPrice: 50 }] },
    invoice: { id: 'invoice', invoiceNumber: 'INV', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line', description: 'Line', quantity: 2, unitPrice: 50 }] },
    siblingInvoices: [],
  };
  it('blocks overflow in cumulative goods receipts and returns finite summaries', () => {
    const result = evaluateThreeWayMatch({ ...base, receiptItems: [
      { purchaseOrderItemId: 'line', receivedQuantity: 1e308, rejectedQuantity: 0 },
      { purchaseOrderItemId: 'line', receivedQuantity: 1e308, rejectedQuantity: 0 },
    ] });
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_RECEIPT_AGGREGATE', severity: 'BLOCKING' })]));
    expect(result.matched).toBe(false);
    expect(Number.isFinite(result.totals.receivedValue)).toBe(true);
    expect(Number.isFinite(result.lines[0].receivedQuantity)).toBe(true);
  });
  it('blocks overflow in cumulative invoice quantities', () => {
    const result = evaluateThreeWayMatch({ ...base, receiptItems: [{ purchaseOrderItemId: 'line', receivedQuantity: 2, rejectedQuantity: 0 }],
      invoice: { ...base.invoice, items: [
        { purchaseOrderItemId: 'line', description: 'Line', quantity: 1e308, unitPrice: 0 },
        { purchaseOrderItemId: 'line', description: 'Line', quantity: 1e308, unitPrice: 0 },
      ] },
    });
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INVOICE_AGGREGATE', severity: 'BLOCKING' })]));
    expect(result.matched).toBe(false);
    expect(Number.isFinite(result.lines[0].invoicedQuantity)).toBe(true);
  });
  it('blocks receipt total overflow across distinct purchase order lines', () => {
    const result = evaluateThreeWayMatch({
      ...base,
      purchaseOrder: { ...base.purchaseOrder, items: [
        { id: 'line', name: 'Line', quantity: 2, unitPrice: 50 },
        { id: 'other', name: 'Other', quantity: 2, unitPrice: 50 },
      ] },
      receiptItems: [
        { purchaseOrderItemId: 'line', receivedQuantity: 1e308, rejectedQuantity: 0 },
        { purchaseOrderItemId: 'other', receivedQuantity: 1e308, rejectedQuantity: 0 },
      ],
    });
    expect(result.exceptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_RECEIPT_TOTAL', severity: 'BLOCKING' }),
    ]));
    expect(result.matched).toBe(false);
  });
});
