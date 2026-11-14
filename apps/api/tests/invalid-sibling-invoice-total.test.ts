import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

const base = {
  purchaseOrder: { id: 'po-1', poNumber: 'PO-1', currency: 'USD', total: 100, items: [{ id: 'line-1', name: 'Item', quantity: 1, unitPrice: 100 }] },
  receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 1, rejectedQuantity: 0 }],
  invoice: { id: 'inv-1', invoiceNumber: 'INV-1', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line-1', description: 'Item', quantity: 1, unitPrice: 100 }] },
  siblingInvoices: [],
};

describe('historical sibling invoice totals', () => {
  for (const total of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    it('blocks malformed sibling invoice total ' + String(total), () => {
      const result = evaluateThreeWayMatch({ ...base, siblingInvoices: [{ id: 'inv-2', invoiceNumber: 'INV-2', purchaseOrderId: 'po-1', total }] });
      expect(result.matched).toBe(false);
      expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_SIBLING_INVOICE_TOTAL', severity: 'BLOCKING' })]));
    });
  }
});
