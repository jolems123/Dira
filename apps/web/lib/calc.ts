/**
 * Live previews for forms. Mirrors calculateTotals in apps/api/src/lib/procurement-rules.ts;
 * the API recalculates everything on save, so these figures are never trusted server-side.
 */
export const VAT_RATE = 0.18;

const round2 = (value: number) => Number(value.toFixed(2));

/** Form inputs arrive as strings; blank or invalid entries count as zero. */
export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateTotals(input: {
  lines: Array<{ quantity: number; unitPrice: number }>;
  deliveryFee?: number;
  discount?: number;
  vatApplies?: boolean;
}) {
  const lineTotals = input.lines.map((line) => round2(line.quantity * line.unitPrice));
  const subtotal = round2(lineTotals.reduce((sum, value) => sum + value, 0));
  const deliveryFee = input.deliveryFee ?? 0;
  const discount = input.discount ?? 0;
  const tax = input.vatApplies === false ? 0 : round2(Math.max(subtotal + deliveryFee - discount, 0) * VAT_RATE);
  const total = round2(subtotal + tax + deliveryFee - discount);
  return { lineTotals, subtotal, deliveryFee, discount, tax, total };
}
