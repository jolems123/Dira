import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

describe('three-way match legacy missing quantities', () => {
  const match = (receivedQuantity: number | null | undefined, rejectedQuantity: number | null | undefined, invoiceQuantity: number | null | undefined) =>
    evaluateThreeWayMatch({
      purchaseOrder: { id: 'po', poNumber: 'PO-1', currency: 'USD', total: 100, items: [{ id: 'line', name: 'Supply', quantity: 10, unitPrice: 10 }] },
      receiptItems: [{ purchaseOrderItemId: 'line', receivedQuantity, rejectedQuantity }],
      invoice: { id: 'invoice', invoiceNumber: 'INV-1', currency: 'USD', total: 100, subtotal: 100, tax: 0, items: [{ purchaseOrderItemId: 'line', description: 'Supply', quantity: invoiceQuantity, unitPrice: 10 }] },
      siblingInvoices: [],
    });

  it.each([null, undefined])('blocks missing rejected receipt quantity %s', (missing) => {
    const result = match(10, missing, 10);
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((issue) => issue.code === 'INVALID_RECEIPT_QUANTITY' && issue.severity === 'BLOCKING')).toBe(true);
  });

  it.each([null, undefined])('blocks missing received receipt quantity %s', (missing) => {
    const result = match(missing, 0, 10);
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((issue) => issue.code === 'INVALID_RECEIPT_QUANTITY')).toBe(true);
  });

  it.each([null, undefined])('blocks missing invoice quantity %s', (missing) => {
    const result = match(10, 0, missing);
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((issue) => issue.code === 'INVALID_INVOICE_QUANTITY')).toBe(true);
  });

  it('does not flag complete valid receipt and invoice quantities as invalid', () => {
    const result = match(10, 0, 10);
    expect(result.exceptions.some((issue) => issue.code === 'INVALID_RECEIPT_QUANTITY' || issue.code === 'INVALID_INVOICE_QUANTITY')).toBe(false);
  });
});
