import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch, type ThreeWayMatchInput } from '../src/lib/procurement-rules';

describe('invoice line price integrity', () => {
  it('blocks conflicting unit prices for the same PO item instead of trusting the last price', () => {
    const input: ThreeWayMatchInput = {
      purchaseOrder: { id: 'po', poNumber: 'PO-1', currency: 'USD', total: 200, items: [{ id: 'item', name: 'Widget', quantity: 2, unitPrice: 100 }] },
      receiptItems: [{ purchaseOrderItemId: 'item', receivedQuantity: 2, rejectedQuantity: 0 }],
      invoice: { id: 'invoice', invoiceNumber: 'INV-1', currency: 'USD', total: 200, subtotal: 200, tax: 0,
        items: [{ purchaseOrderItemId: 'item', description: 'Widget', quantity: 1, unitPrice: 200 },
          { purchaseOrderItemId: 'item', description: 'Widget', quantity: 1, unitPrice: 100 }] },
      siblingInvoices: [],
    };
    const result = evaluateThreeWayMatch(input);
    expect(result.matched).toBe(false);
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CONFLICTING_INVOICE_PRICES', severity: 'BLOCKING' })]));
  });
});
