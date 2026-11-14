import { describe, expect, it } from 'vitest';
import { calculateInternationalTotals, currencyMinorUnits } from './international-finance';

describe('international finance fail-closed arithmetic', () => {
  it('rejects missing jurisdiction-reviewed tax treatment', () => {
    expect(() => calculateInternationalTotals({ currency: 'USD', lines: [{ quantity: 1, unitPrice: 100 }] })).toThrow(/tax/i);
  });
  it('does not silently apply Uganda VAT to foreign purchases', () => {
    expect(calculateInternationalTotals({ currency: 'USD', taxRate: 0, lines: [{ quantity: 1, unitPrice: 100 }] }).tax).toBe(0);
  });
  it('respects zero and three-decimal currency precision', () => {
    expect(currencyMinorUnits('JPY')).toBe(0);
    expect(currencyMinorUnits('KWD')).toBe(3);
    expect(calculateInternationalTotals({ currency: 'JPY', taxRate: 0, lines: [{ quantity: 1, unitPrice: 100.6 }] }).total).toBe(101);
    expect(calculateInternationalTotals({ currency: 'KWD', taxRate: 0, lines: [{ quantity: 1, unitPrice: 1.2344 }] }).total).toBe(1.234);
  });
  it('avoids binary floating-point errors when summing line totals', () => {
    const result = calculateInternationalTotals({ currency: 'USD', taxRate: 0, lines: [
      { quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 },
    ] });
    expect(result.subtotal).toBe(0.3);
    expect(result.total).toBe(0.3);
  });
  it('rejects unsafe integer-scale inputs rather than producing imprecise totals', () => {
    expect(() => calculateInternationalTotals({ currency: 'USD', taxRate: 0, lines: [
      { quantity: 1, unitPrice: Number.MAX_SAFE_INTEGER },
    ] })).toThrow(/precision|range|amount/i);
  });
  it('rejects contradictory explicit tax and tax rate', () => {
    expect(() => calculateInternationalTotals({ currency: 'USD', tax: 5, taxRate: 0.2, lines: [{ quantity: 1, unitPrice: 100 }] })).toThrow(/tax/i);
  });
  it('rejects fractional quantities below zero and unsupported currency casing', () => {
    expect(() => calculateInternationalTotals({ currency: 'USD', tax: 0, lines: [{ quantity: -0.1, unitPrice: 1 }] })).toThrow();
    expect(() => currencyMinorUnits('usd')).toThrow();
  });
  it('rejects unknown currencies and invalid rates rather than guessing', () => {
    expect(() => currencyMinorUnits('ZZZ')).toThrow();
    expect(() => calculateInternationalTotals({ currency: 'USD', taxRate: -1, lines: [] })).toThrow();
  });
});
