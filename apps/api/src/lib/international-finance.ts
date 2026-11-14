/**
 * Opt-in international arithmetic. Never infer a country's tax rate from currency.
 * The caller must supply a jurisdiction-reviewed tax rate or explicit tax amount.
 * This module is not wired to legacy quote/invoice routes until migration review.
 */
const SUPPORTED = new Set('AED AUD BHD CAD CHF CNY DKK EUR GBP GHS INR JPY KES KWD NGN NOK NZD OMR QAR RWF SAR SEK SGD TZS UGX USD ZAR'.split(' '));

export function currencyMinorUnits(currency: string): number {
  if (!SUPPORTED.has(currency)) throw new Error('Unsupported currency: use an approved ISO 4217 code');
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

export interface InternationalLine { quantity: number; unitPrice: number }
export interface InternationalTotalsInput {
  currency: string;
  lines: InternationalLine[];
  deliveryFee?: number;
  discount?: number;
  /** Reviewed decimal rate, e.g. 0.18; never a global default. */
  taxRate?: number;
  /** Explicit amount can be used for exemptions or manually reviewed taxes. */
  tax?: number;
}

export function calculateInternationalTotals(input: InternationalTotalsInput) {
  const digits = currencyMinorUnits(input.currency);
  if (input.tax === undefined && input.taxRate === undefined) {
    throw new Error('Explicit reviewed tax rate or tax amount required');
  }
  const valid = (value: number) => Number.isFinite(value) && value >= 0;
  if (input.taxRate !== undefined && (!valid(input.taxRate) || input.taxRate > 1)) throw new Error('Invalid tax rate');
  if (input.tax !== undefined && !valid(input.tax)) throw new Error('Invalid tax amount');
  if (input.lines.some(line => !valid(line.quantity) || !valid(line.unitPrice))) throw new Error('Invalid line amount');
  if (!valid(input.deliveryFee ?? 0) || !valid(input.discount ?? 0)) throw new Error('Invalid adjustment');
  const round = (n: number) => Number(n.toFixed(digits));
  const lineTotals = input.lines.map(line => round(line.quantity * line.unitPrice));
  const subtotal = round(lineTotals.reduce((sum, value) => sum + value, 0));
  const deliveryFee = round(input.deliveryFee ?? 0);
  const discount = round(input.discount ?? 0);
  if (discount > subtotal + deliveryFee) throw new Error('Discount exceeds taxable base');
  const tax = round(input.tax ?? ((subtotal + deliveryFee - discount) * input.taxRate!));
  const total = round(subtotal + deliveryFee - discount + tax);
  if (![subtotal, tax, total].every(Number.isFinite)) throw new Error('Invalid monetary result');
  return { currency: input.currency, lineTotals, subtotal, deliveryFee, discount, tax, total };
}
