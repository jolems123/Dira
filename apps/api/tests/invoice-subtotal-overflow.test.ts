import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

const base = {
  purchaseOrder: { id: 'po', poNumber: 'PO', currency: 'USD', total: 100, items: [{ id: 'line', name: 'Widget', quantity: 2, unitPrice: 50 }] },
  receiptItems: [{ purchaseOrderItemId: 'line', receivedQuantity: 2, rejectedQuantity: 0 }],
  invoice: { id: 'inv', invoiceNumber: 'INV', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line', description: 'Widget', quantity: 2, unitPrice: 50 }] },
  siblingInvoices: [],
};
describe('historical malformed invoice extended amounts', () => {
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    it('blocks nonfinite line arithmetic instead of silently passing subtotal comparison', () => {
      const result = evaluateThreeWayMatch({ ...base, invoice: { ...base.invoice, items: [{ ...base.invoice.items[0], quantity: bad }] } });
      expect(result.matched).toBe(false);
      expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INVOICE_QUANTITY', severity: 'BLOCKING' })]));
      expect(Number.isFinite(result.totals.invoiceTotal)).toBe(true);
    });
  }
  it('blocks overflow from finite quantities and prices', () => {
    const result = evaluateThreeWayMatch({ ...base, invoice: { ...base.invoice, items: [{ ...base.invoice.items[0], quantity: 1e308, unitPrice: 1e308 }] } });
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_INVOICE_SUBTOTAL', severity: 'BLOCKING' })]));
    expect(result.matched).toBe(false);
  });
});
