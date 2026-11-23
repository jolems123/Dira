import { describe, expect, it } from 'vitest';
import { maySubmitPurchaseRequest } from '../src/lib/request-ownership';

describe('purchase request submission ownership', () => {
  it('allows the original requester', () => {
    expect(maySubmitPurchaseRequest('user-a', 'user-a')).toBe(true);
  });
  it('denies another user in the same organisation', () => {
    expect(maySubmitPurchaseRequest('user-a', 'user-b')).toBe(false);
  });
  it('fails closed on missing identifiers', () => {
    expect(maySubmitPurchaseRequest('', 'user-b')).toBe(false);
    expect(maySubmitPurchaseRequest('user-a', '')).toBe(false);
  });
});
