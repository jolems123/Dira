import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('historical sibling invoice financial evidence', () => {
  const base = {
    purchaseOrder: { id: 'po-1', poNumber: 'PO-1', currency: 'USD', total: 100, items: [{ id: 'line-1', name: 'Goods', quantity: 1, unitPrice: 100 }] },
    receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 1, rejectedQuantity: 0 }],
    invoice: { id: 'invoice-1', invoiceNumber: 'INV-1', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line-1', description: 'Goods', quantity: 1, unitPrice: 100 }] },
    siblingInvoices: [],
  };
  it.each([null, undefined, Number.NaN, -1])('blocks absent or invalid sibling invoice total %s', (total) => {
    const result = evaluateThreeWayMatch({ ...base, siblingInvoices: [{ id: 'invoice-2', invoiceNumber: 'INV-2', total, purchaseOrderId: 'po-1' }] });
    expect(result.exceptions.some((exception) => exception.code === 'INVALID_SIBLING_INVOICE_TOTAL' && exception.severity === 'BLOCKING')).toBe(true);
    expect(result.matched).toBe(false);
  });
  it('does not reject a legitimate zero-value sibling invoice as invalid', () => {
    const result = evaluateThreeWayMatch({ ...base, siblingInvoices: [{ id: 'invoice-2', invoiceNumber: 'INV-2', total: 0, purchaseOrderId: 'po-1' }] });
    expect(result.exceptions.some((exception) => exception.code === 'INVALID_SIBLING_INVOICE_TOTAL')).toBe(false);
  });
});
