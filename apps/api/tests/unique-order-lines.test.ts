import { describe, expect, it } from 'vitest';
import { hasUniqueOrderLineIds } from '../src/lib/unique-order-lines';

describe('order line reference integrity', () => {
  it('rejects duplicate dispatch lines', () => {
    expect(hasUniqueOrderLineIds([{ purchaseOrderItemId: 'a' }, { purchaseOrderItemId: 'a' }])).toBe(false);
  });
  it('rejects duplicate receipt lines', () => {
    expect(hasUniqueOrderLineIds([{ purchaseOrderItemId: 'a', receivedQuantity: 1 }, { purchaseOrderItemId: 'a', receivedQuantity: 2 }])).toBe(false);
  });
  it('accepts distinct lines', () => {
    expect(hasUniqueOrderLineIds([{ purchaseOrderItemId: 'a' }, { purchaseOrderItemId: 'b' }])).toBe(true);
  });
});
