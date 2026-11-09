import { describe, expect, it } from 'vitest';
import { validateQuotedRfqItems } from '../src/lib/quote-item-validation';

describe('supplier quotation item integrity', () => {
  it('rejects repeated RFQ item IDs instead of billing the same line twice', () => {
    expect(validateQuotedRfqItems(['item-a', 'item-a'], ['item-a', 'item-b'])).toMatch(/duplicate/i);
  });
  it('rejects unknown RFQ items', () => {
    expect(validateQuotedRfqItems(['other'], ['item-a'])).toMatch(/invalid/i);
  });
  it('accepts distinct known RFQ items', () => {
    expect(validateQuotedRfqItems(['item-a', 'item-b'], ['item-a', 'item-b'])).toBeNull();
  });
});
