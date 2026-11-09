import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('invoiceable quantities across partial receipts', () => {
  const items = [
    { id: 'a', name: 'A', quantity: 10, unitPrice: 2 },
    { id: 'b', name: 'B', quantity: 10, unitPrice: 3 },
  ];
  it('does not bill unreceived lines just because another line was received', () => {
    const result = invoiceableLines({
      items,
      deliveries: [
        { kind: 'DISPATCH', items: [
          { purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 },
          { purchaseOrderItemId: 'b', orderedQuantity: 10, receivedQuantity: 0, rejectedQuantity: 0 },
        ] },
        { kind: 'RECEIPT', items: [
          { purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 4, rejectedQuantity: 0 },
        ] },
      ],
      invoices: [],
    });
    expect(result.basis).toBe('RECEIVED');
    expect(result.lines.map(line => line.quantity)).toEqual([4, 0]);
  });
  it('never allows negative rejected or received quantities to increase billable quantity', () => {
    const result = invoiceableLines({
      items,
      deliveries: [{ kind: 'RECEIPT', items: [
        { purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 3, rejectedQuantity: -4 },
        { purchaseOrderItemId: 'b', orderedQuantity: 10, receivedQuantity: -2, rejectedQuantity: 0 },
      ] }],
      invoices: [],
    });
    expect(result.lines.map(line => line.quantity)).toEqual([3, 0]);
  });
  it('does not increase billable quantities through negative invoice lines', () => {
    const result = invoiceableLines({
      items,
      deliveries: [{ kind: 'RECEIPT', items: [{ purchaseOrderItemId: 'a', orderedQuantity: 10, receivedQuantity: 4, rejectedQuantity: 0 }] }],
      invoices: [{ status: 'SUBMITTED', items: [{ purchaseOrderItemId: 'a', quantity: -3 }] }],
    });
    expect(result.lines[0].quantity).toBe(4);
  });
});
