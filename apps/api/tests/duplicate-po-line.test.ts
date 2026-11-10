import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('three-way matching duplicate purchase-order identifiers', () => {
  const base = {
    purchaseOrder: {
      id: 'po-1', poNumber: 'PO-1', currency: 'USD', total: 100,
      items: [{ id: 'line-1', name: 'Widget', quantity: 2, unitPrice: 50 }],
    },
    receiptItems: [{ purchaseOrderItemId: 'line-1', receivedQuantity: 2, rejectedQuantity: 0 }],
    invoice: {
      id: 'inv-1', invoiceNumber: 'INV-1', currency: 'USD', total: 100, subtotal: 100, tax: 0,
      items: [{ purchaseOrderItemId: 'line-1', description: 'Widget', quantity: 2, unitPrice: 50 }],
    },
    siblingInvoices: [],
  };
  it('blocks duplicate purchase-order item identifiers instead of matching ambiguous lines', () => {
    const result = evaluateThreeWayMatch({
      ...base,
      purchaseOrder: { ...base.purchaseOrder, items: [...base.purchaseOrder.items, { ...base.purchaseOrder.items[0], name: 'Duplicate' }] },
    });
    expect(result.exceptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'DUPLICATE_PO_LINE', severity: 'BLOCKING' }),
    ]));
    expect(result.matched).toBe(false);
  });
  it('does not flag unique purchase-order item identifiers', () => {
    const result = evaluateThreeWayMatch(base);
    expect(result.exceptions.some((exception) => exception.code === 'DUPLICATE_PO_LINE')).toBe(false);
  });
});
