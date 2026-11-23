import { describe, expect, it } from 'vitest';
import { evaluateThreeWayMatch } from '../src/lib/procurement-rules';

const valid = () => ({
  purchaseOrder: { id: 'po', poNumber: 'PO-1', currency: 'USD', total: 10, items: [{ id: 'line', name: 'Item', quantity: 1, unitPrice: 10 }] },
  receiptItems: [{ purchaseOrderItemId: 'line', receivedQuantity: 1, rejectedQuantity: 0 }],
  invoice: { id: 'inv', invoiceNumber: 'INV-1', currency: 'USD', total: 10, subtotal: 10, tax: 0, items: [{ purchaseOrderItemId: 'line', description: 'Item', quantity: 1, unitPrice: 10 }] },
  siblingInvoices: [],
});

describe('historical blank financial evidence fails closed during three-way matching', () => {
  it.each([
    ['receipt received quantity', (data: ReturnType<typeof valid>) => { data.receiptItems[0].receivedQuantity = '  ' as never; }, 'INVALID_RECEIPT_QUANTITY'],
    ['receipt rejected quantity', (data: ReturnType<typeof valid>) => { data.receiptItems[0].rejectedQuantity = '' as never; }, 'INVALID_RECEIPT_QUANTITY'],
    ['invoice line quantity', (data: ReturnType<typeof valid>) => { data.invoice.items[0].quantity = '' as never; }, 'INVALID_INVOICE_QUANTITY'],
    ['invoice line unit price', (data: ReturnType<typeof valid>) => { data.invoice.items[0].unitPrice = ' ' as never; }, 'INVALID_INVOICE_QUANTITY'],
    ['PO line quantity', (data: ReturnType<typeof valid>) => { data.purchaseOrder.items[0].quantity = '' as never; }, 'INVALID_PO_LINE'],
    ['PO line unit price', (data: ReturnType<typeof valid>) => { data.purchaseOrder.items[0].unitPrice = ' ' as never; }, 'INVALID_PO_LINE'],
    ['invoice total', (data: ReturnType<typeof valid>) => { data.invoice.total = '' as never; }, 'INVALID_INVOICE_TOTAL'],
    ['invoice subtotal', (data: ReturnType<typeof valid>) => { data.invoice.subtotal = ' ' as never; }, 'INVALID_INVOICE_TOTAL'],
    ['invoice tax', (data: ReturnType<typeof valid>) => { data.invoice.tax = '' as never; }, 'INVALID_INVOICE_TOTAL'],
    ['PO total', (data: ReturnType<typeof valid>) => { data.purchaseOrder.total = '' as never; }, 'INVALID_PO_TOTAL'],
  ])('blocks blank %s', (_name, mutate, code) => {
    const data = valid();
    mutate(data);
    const result = evaluateThreeWayMatch(data);
    expect(result.matched).toBe(false);
    expect(result.exceptions.some((e) => e.code === code && e.severity === 'BLOCKING')).toBe(true);
  });

  it('retains legitimate numeric zero tax and rejected quantity', () => {
    const result = evaluateThreeWayMatch(valid());
    expect(result.exceptions.some((e) => e.code === 'INVALID_RECEIPT_QUANTITY' || e.code === 'INVALID_INVOICE_TOTAL')).toBe(false);
  });
});
