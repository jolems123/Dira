import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition, PO_TRANSITIONS, INVOICE_TRANSITIONS } from '../src/lib/procurement-rules';

describe('fail-closed procurement status transitions', () => {
  it('rejects unknown status even for a same-status request', () => {
    expect(canTransition(PO_TRANSITIONS, 'FORGED', 'FORGED')).toBe(false);
    expect(() => assertTransition(PO_TRANSITIONS, 'FORGED', 'FORGED', 'purchase order')).toThrow(/Invalid purchase order transition/);
  });

  it('rejects unknown target and unknown source statuses', () => {
    expect(canTransition(INVOICE_TRANSITIONS, 'SUBMITTED', 'FORGED')).toBe(false);
    expect(canTransition(INVOICE_TRANSITIONS, 'FORGED', 'APPROVED')).toBe(false);
  });

  it('preserves valid no-op and explicit transitions', () => {
    expect(canTransition(PO_TRANSITIONS, 'DRAFT', 'DRAFT')).toBe(true);
    expect(canTransition(PO_TRANSITIONS, 'DRAFT', 'ISSUED')).toBe(true);
    expect(canTransition(PO_TRANSITIONS, 'CANCELLED', 'ISSUED')).toBe(false);
  });
});
