import { Prisma } from '@prisma/client';

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
  if (input.tax !== undefined && input.taxRate !== undefined) throw new Error('Specify either explicit tax or tax rate, not both');
  if (input.tax === undefined && input.taxRate === undefined) {
    throw new Error('Explicit reviewed tax rate or tax amount required');
  }
  const valid = (value: number) => Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.trunc(value));
  if (input.taxRate !== undefined && (!valid(input.taxRate) || input.taxRate > 1)) throw new Error('Invalid tax rate');
  if (input.tax !== undefined && !valid(input.tax)) throw new Error('Invalid tax amount');
  if (input.lines.some(line => !valid(line.quantity) || !valid(line.unitPrice))) throw new Error('Invalid line amount');
  if (!valid(input.deliveryFee ?? 0) || !valid(input.discount ?? 0)) throw new Error('Invalid adjustment');
  const decimal = (n: number) => new Prisma.Decimal(n.toString());
  const rounded = (n: Prisma.Decimal) => n.toDecimalPlaces(digits, Prisma.Decimal.ROUND_HALF_UP);
  const safeNumber = (n: Prisma.Decimal) => {
    if (!n.isFinite() || n.abs().greaterThanOrEqualTo(Number.MAX_SAFE_INTEGER)) throw new Error('Monetary precision range exceeded');
    return n.toNumber();
  };
  const lineAmounts = input.lines.map(line => rounded(decimal(line.quantity).times(decimal(line.unitPrice))));
  const lineTotals = lineAmounts.map(safeNumber);
  const subtotalAmount = lineAmounts.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
  const deliveryAmount = rounded(decimal(input.deliveryFee ?? 0));
  const discountAmount = rounded(decimal(input.discount ?? 0));
  const taxableAmount = subtotalAmount.plus(deliveryAmount).minus(discountAmount);
  if (taxableAmount.isNegative()) throw new Error('Discount exceeds taxable base');
  const taxAmount = rounded(input.tax !== undefined ? decimal(input.tax) : taxableAmount.times(decimal(input.taxRate!)));
  const totalAmount = taxableAmount.plus(taxAmount);
  const subtotal = safeNumber(subtotalAmount);
  const deliveryFee = safeNumber(deliveryAmount);
  const discount = safeNumber(discountAmount);
  const tax = safeNumber(taxAmount);
  const total = safeNumber(totalAmount);
  return { currency: input.currency, lineTotals, subtotal, deliveryFee, discount, tax, total };
}
