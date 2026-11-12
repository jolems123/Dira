import { describe, expect, it } from 'vitest';
import { paymentTermDays } from '../src/lib/procurement-rules';

describe('payment term parsing', () => {
  it('recognizes standard net terms and days', () => {
    expect(paymentTermDays('NET30')).toBe(30);
    expect(paymentTermDays('Net 45')).toBe(45);
    expect(paymentTermDays('60 days')).toBe(60);
    expect(paymentTermDays('COD')).toBe(0);
  });
  it('does not interpret invoice IDs or years as due dates', () => {
    expect(paymentTermDays('Invoice 2026, subject to contract', 14)).toBe(14);
    expect(paymentTermDays('Reference 90', 14)).toBe(14);
  });
  it('rejects zero and unsupported term durations instead of extracting arbitrary digits', () => {
    expect(paymentTermDays('NET0', 14)).toBe(14);
    expect(paymentTermDays('NET999', 14)).toBe(14);
    expect(paymentTermDays('net 30 invoice 2026')).toBe(30);
  });
});
