import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('three-way match missing historical document totals', () => {
  const match = (field: 'poTotal' | 'invoiceTotal' | 'subtotal' | 'tax', value: number | null | undefined) => {
    const po = { id: 'po', poNumber: 'PO-1', currency: 'USD', total: 100 as number | null | undefined, items: [{ id: 'line', name: 'Supply', quantity: 10, unitPrice: 10 }] };
    const invoice = { id: 'inv', invoiceNumber: 'INV-1', currency: 'USD', total: 100 as number | null | undefined, subtotal: 100 as number | null | undefined, tax: 0 as number | null | undefined, items: [{ purchaseOrderItemId: 'line', description: 'Supply', quantity: 10, unitPrice: 10 }] };
    if (field === 'poTotal') po.total = value;
    if (field === 'invoiceTotal') invoice.total = value;
    if (field === 'subtotal') invoice.subtotal = value;
    if (field === 'tax') invoice.tax = value;
    return evaluateThreeWayMatch({ purchaseOrder: po, receiptItems: [{ purchaseOrderItemId: 'line', receivedQuantity: 10, rejectedQuantity: 0 }], invoice, siblingInvoices: [] });
  };

  it.each(['poTotal', 'invoiceTotal', 'subtotal', 'tax'] as const)('rejects null %s', (field) => {
    const result = match(field, null);
    expect(result.matched).toBe(false);
    expect(result.exceptions).toEqual(expect.arrayContaining([expect.objectContaining({ code: field === 'poTotal' ? 'INVALID_PO_TOTAL' : 'INVALID_INVOICE_TOTAL', severity: 'BLOCKING' })]));
  });

  it.each(['poTotal', 'invoiceTotal', 'subtotal', 'tax'] as const)('rejects undefined %s', (field) => {
    expect(match(field, undefined).matched).toBe(false);
  });

  it('accepts complete, valid totals', () => {
    const result = match('tax', 0);
    expect(result.matched).toBe(true);
  });
});
