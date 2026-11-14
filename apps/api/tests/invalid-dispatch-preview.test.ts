import { describe, expect, it } from 'vitest';
import { invoiceableLines } from '../src/lib/procurement-rules';

describe('historical dispatch evidence quarantine', () => {
  const po = [{ id: 'po-line', name: 'Material', quantity: 5, unitPrice: 12 }];
  const dispatch = (orderedQuantity: number | null) => ({
    kind: 'DISPATCH',
    items: [{ purchaseOrderItemId: 'po-line', orderedQuantity, receivedQuantity: 0, rejectedQuantity: 0 }],
  });

  it.each([null, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not bill when any dispatch has invalid quantity %s',
    (invalid) => {
      const result = invoiceableLines({
        items: po,
        deliveries: [dispatch(invalid), dispatch(5)],
        invoices: [],
      });
      expect(result.lines[0].quantity).toBe(0);
    },
  );

  it('retains legitimate dispatch-based preview when all evidence is valid', () => {
    const result = invoiceableLines({
      items: po,
      deliveries: [dispatch(3)],
      invoices: [],
    });
    expect(result.lines[0].quantity).toBe(3);
  });
});
