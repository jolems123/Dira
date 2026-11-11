import { Prisma } from '@prisma/client';

export type Decimalish = Prisma.Decimal | number | string | null | undefined;

export function num(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Decimal ROUND_HALF_UP (4), avoiding binary floating-point rounding in money. */
function moneyDecimal(value: number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, 4);
}

export function round2(value: number): number {
  return moneyDecimal(value).toNumber();
}

/** Uganda standard-rate VAT (VAT Act, Cap. 349). */
export const UGANDA_VAT_RATE = 0.18;

/**
 * Tax to charge on a taxable amount. An explicit amount wins so suppliers that are
 * not VAT-registered, or selling exempt/zero-rated goods, can submit 0.
 */
export function resolveTax(taxableAmount: number, explicitTax?: number): number {
  if (explicitTax !== undefined) return round2(explicitTax);
  return round2(Math.max(taxableAmount, 0) * UGANDA_VAT_RATE);
}

export interface PricedLine {
  quantity: number;
  unitPrice?: number | null;
}

/**
 * Single source of truth for document arithmetic: line totals, subtotal, VAT and grand total.
 * VAT is charged on subtotal + delivery - discount unless an explicit tax amount is given.
 */
export function calculateTotals(input: { lines: PricedLine[]; deliveryFee?: number; discount?: number; tax?: number }) {
  // Round individual extended prices first, then add as exact decimal values.
  const lineAmounts = input.lines.map((line) =>
    moneyDecimal(new Prisma.Decimal(line.quantity).mul(line.unitPrice ?? 0)));
  const lineTotals = lineAmounts.map((amount) => amount.toNumber());
  const subtotalAmount = moneyDecimal(lineAmounts.reduce((sum, amount) => sum.plus(amount), new Prisma.Decimal(0)));
  const deliveryAmount = moneyDecimal(input.deliveryFee ?? 0);
  const discountAmount = moneyDecimal(input.discount ?? 0);
  const taxableAmount = subtotalAmount.plus(deliveryAmount).minus(discountAmount);
  const taxAmount = input.tax === undefined
    ? moneyDecimal(Prisma.Decimal.max(taxableAmount, 0).mul(UGANDA_VAT_RATE))
    : moneyDecimal(input.tax);
  const totalAmount = moneyDecimal(taxableAmount.plus(taxAmount));
  return {
    lineTotals,
    subtotal: subtotalAmount.toNumber(),
    deliveryFee: deliveryAmount.toNumber(),
    discount: discountAmount.toNumber(),
    tax: taxAmount.toNumber(),
    total: totalAmount.toNumber(),
  };
}

/** Days until payment is due for common term spellings: "NET30", "Net 45", "60 days", "COD". */
export function paymentTermDays(terms: string | null | undefined, fallback = 30): number {
  if (!terms) return fallback;
  if (/\b(cod|cash on delivery|on delivery|immediate|due on receipt)\b/i.test(terms)) return 0;
  const match = terms.match(/(\d{1,3})/);
  return match ? Number(match[1]) : fallback;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export type ScheduleFrequencyValue = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

/** Next occurrence after `from`. Month steps clamp to the last day, so 31 Jan -> 28/29 Feb. */
export function nextOccurrence(from: Date, frequency: ScheduleFrequencyValue): Date {
  if (frequency === 'WEEKLY') return addDays(from, 7);
  const months = frequency === 'MONTHLY' ? 1 : 3;
  const target = new Date(from.getTime());
  const day = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/** Advances a schedule past `now`, skipping missed periods so a long outage creates one draft, not a backlog. */
export function advanceSchedule(nextRunAt: Date, frequency: ScheduleFrequencyValue, now: Date): Date {
  let candidate = nextOccurrence(nextRunAt, frequency);
  while (candidate <= now) candidate = nextOccurrence(candidate, frequency);
  return candidate;
}

const NON_BILLING_INVOICE_STATUSES = ['VOID', 'REJECTED', 'CANCELLED'];

/**
 * What a supplier can still bill per purchase order line: net received quantity (or dispatched,
 * when the buyer has not recorded a receipt yet) minus quantities on live invoices.
 */
export function invoiceableLines(input: {
  items: Array<{ id: string; name: string; quantity: Decimalish; unitPrice: Decimalish }>;
  deliveries: Array<{ kind: string; items: Array<{ purchaseOrderItemId: string | null; orderedQuantity: Decimalish; receivedQuantity: Decimalish; rejectedQuantity: Decimalish }> }>;
  invoices: Array<{ status: string; items: Array<{ purchaseOrderItemId: string | null; quantity: Decimalish }> }>;
}) {
  // Historical rows can predate request validation; never turn nonfinite values into billable quantities.
  const safeQuantity = (value: Decimalish): number => {
    const parsed = num(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };
  // Historical records may individually contain finite numbers whose cumulative sum
  // overflows Number. Cap preview aggregates conservatively instead of emitting Infinity.
  const addPreviewQuantity = (current: number, addition: number): number =>
    Math.min(Number.MAX_SAFE_INTEGER, current + addition);
  const received = new Map<string, number>();
  const invalidReceiptLines = new Set<string>();
  const dispatched = new Map<string, number>();
  const invalidDispatchLines = new Set<string>();
  for (const delivery of input.deliveries) {
    for (const item of delivery.items) {
      if (!item.purchaseOrderItemId) continue;
      if (delivery.kind === 'RECEIPT') {
        // Invalid legacy rejection evidence cannot be treated as zero rejected:
        // doing so would inflate the supplier's billable quantity.
        const rawReceived = num(item.receivedQuantity);
        const rawRejected = num(item.rejectedQuantity);
        const validReceipt = item.receivedQuantity !== null && item.receivedQuantity !== undefined
          && item.rejectedQuantity !== null && item.rejectedQuantity !== undefined
          && Number.isFinite(rawReceived) && Number.isFinite(rawRejected)
          && rawReceived >= 0 && rawRejected >= 0 && rawRejected <= rawReceived;
        // A malformed receipt is evidence of an attempted receipt, not absence of one.
        // Keep a zero-net marker so dispatch cannot authorize invoicing this line.
        if (!validReceipt) invalidReceiptLines.add(item.purchaseOrderItemId);
        const netReceived = validReceipt ? rawReceived - rawRejected : 0;
        received.set(item.purchaseOrderItemId, invalidReceiptLines.has(item.purchaseOrderItemId)
          ? 0
          : addPreviewQuantity(received.get(item.purchaseOrderItemId) ?? 0, netReceived));
      } else if (delivery.kind === 'DISPATCH') {
        // Unknown historical kinds are not evidence that goods were dispatched.
        // An invalid historical dispatch is not proof of zero dispatch. Quarantine
        // the PO line even if another dispatch entry is valid, pending audit.
        const rawDispatched = num(item.orderedQuantity);
        if (item.orderedQuantity === null || item.orderedQuantity === undefined
          || !Number.isFinite(rawDispatched) || rawDispatched < 0) {
          invalidDispatchLines.add(item.purchaseOrderItemId);
        } else {
          dispatched.set(item.purchaseOrderItemId, addPreviewQuantity(dispatched.get(item.purchaseOrderItemId) ?? 0, rawDispatched));
        }
      }
    }
  }
  const invoiced = new Map<string, number>();
  for (const invoice of input.invoices) {
    if (NON_BILLING_INVOICE_STATUSES.includes(invoice.status)) continue;
    for (const item of invoice.items) {
      if (!item.purchaseOrderItemId) continue;
      // Malformed active invoice evidence is uncertain committed quantity, not zero.
      // Reserve the entire preview capacity rather than allowing duplicate billing.
      const rawInvoiced = num(item.quantity);
      if (item.quantity === null || item.quantity === undefined || !Number.isFinite(rawInvoiced) || rawInvoiced < 0) {
        invoiced.set(item.purchaseOrderItemId, Number.MAX_SAFE_INTEGER);
        continue;
      }
      invoiced.set(item.purchaseOrderItemId, addPreviewQuantity(invoiced.get(item.purchaseOrderItemId) ?? 0, rawInvoiced));
    }
  }
  // A legacy PO with duplicate line IDs cannot unambiguously allocate a receipt
  // or prior invoice to a single row. Quarantine every duplicate from previews.
  const seenPoIds = new Set<string>();
  const duplicatePoIds = new Set<string>();
  for (const item of input.items) {
    if (seenPoIds.has(item.id)) duplicatePoIds.add(item.id);
    seenPoIds.add(item.id);
  }
  const anyReceipt = received.size > 0;
  const basis: 'RECEIVED' | 'DISPATCHED' = anyReceipt ? 'RECEIVED' : 'DISPATCHED';
  const lines = input.items.map((item) => {
    // Receipt evidence takes precedence per PO line. Other lines can still use dispatch
    // evidence until their first receipt, including a fully rejected (zero-net) receipt.
    const deliveredQuantity = duplicatePoIds.has(item.id) || invalidReceiptLines.has(item.id)
      || (!received.has(item.id) && invalidDispatchLines.has(item.id))
      ? 0
      : round2((received.has(item.id) ? received : dispatched).get(item.id) ?? 0);
    const invoicedQuantity = round2(invoiced.get(item.id) ?? 0);
    return {
      purchaseOrderItemId: item.id,
      description: item.name,
      orderedQuantity: safeQuantity(item.quantity),
      deliveredQuantity,
      invoicedQuantity,
      // Missing/invalid historical PO price is not authorization to create a new invoice.
      // A genuine zero-price line is valid; only absent, negative or nonfinite evidence fails closed.
      quantity: duplicatePoIds.has(item.id) || item.unitPrice === null || item.unitPrice === undefined
        || !Number.isFinite(num(item.unitPrice)) || num(item.unitPrice) < 0
        ? 0
        : round2(Math.max(0, Math.min(deliveredQuantity, safeQuantity(item.quantity)) - invoicedQuantity)),
      unitPrice: safeQuantity(item.unitPrice),
    };
  });
  return { basis, lines };
}

/** Quantities are compared with a small tolerance to absorb decimal(18,2) rounding. */
export const QTY_EPSILON = 0.005;
export const MONEY_EPSILON = 0.01;

export const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN', 'EXPIRED'],
  SUBMITTED: ['REVISED', 'WITHDRAWN', 'AWARDED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'VIEWED'],
  VIEWED: ['REVISED', 'WITHDRAWN', 'AWARDED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
  REVISED: ['REVISED', 'WITHDRAWN', 'AWARDED', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
  WITHDRAWN: [],
  AWARDED: [],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

export const PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ISSUED', 'SENT', 'CANCELLED'],
  ISSUED: ['ACKNOWLEDGED', 'CANCELLED'],
  SENT: ['ACKNOWLEDGED', 'PROCESSING', 'CANCELLED'],
  ACKNOWLEDGED: ['PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'],
  PROCESSING: ['PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'],
  PARTIALLY_DELIVERED: ['PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'CLOSED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export const INVOICE_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'VOID'],
  RECEIVED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'VOID'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'VOID'],
  VERIFIED: ['APPROVED', 'REJECTED', 'VOID'],
  APPROVED: ['PARTIALLY_PAID', 'PAID', 'VOID'],
  PARTIALLY_PAID: ['PARTIALLY_PAID', 'PAID'],
  PAID: [],
  REJECTED: ['UNDER_REVIEW', 'VOID'],
  DISPUTED: ['UNDER_REVIEW', 'REJECTED', 'VOID'],
  VOID: [],
};

export function canTransition(map: Record<string, string[]>, from: string, to: string): boolean {
  // A no-op must not silently accept an unknown or forged persisted status.
  if (!Object.prototype.hasOwnProperty.call(map, from)) return false;
  if (from === to) return true;
  return (map[from] ?? []).includes(to);
}

export function assertTransition(map: Record<string, string[]>, from: string, to: string, label: string) {
  if (!canTransition(map, from, to)) {
    const error: Error & { status?: number } = new Error(`Invalid ${label} transition: ${from} -> ${to}`);
    error.status = 409;
    throw error;
  }
}

export function isQuoteExpired(validUntil: Date | null | undefined, now = new Date()): boolean {
  if (!validUntil) return false;
  return validUntil.getTime() < now.getTime();
}

export type MatchSeverity = 'BLOCKING' | 'WARNING';

export interface MatchException {
  code: string;
  severity: MatchSeverity;
  message: string;
  details?: Record<string, unknown>;
}

export interface ThreeWayMatchInput {
  purchaseOrder: {
    id: string;
    poNumber: string;
    currency: string;
    total: Decimalish;
    items: Array<{ id: string; name: string; quantity: Decimalish; unitPrice: Decimalish }>;
  };
  /** Only deliveries of kind RECEIPT count as goods received. */
  receiptItems: Array<{ purchaseOrderItemId: string | null; receivedQuantity: Decimalish; rejectedQuantity: Decimalish }>;
  invoice: {
    id: string;
    invoiceNumber: string;
    currency: string;
    total: Decimalish;
    subtotal: Decimalish;
    tax: Decimalish;
    items: Array<{ purchaseOrderItemId: string | null; description: string; quantity: Decimalish; unitPrice: Decimalish }>;
  };
  /** Other invoices for the same supplier used for duplicate detection. */
  siblingInvoices: Array<{ id: string; invoiceNumber: string; total: Decimalish; purchaseOrderId: string | null }>;
  requireReceipt?: boolean;
}

export interface ThreeWayMatchResult {
  matched: boolean;
  blocking: number;
  warnings: number;
  exceptions: MatchException[];
  lines: Array<{
    purchaseOrderItemId: string | null;
    name: string;
    orderedQuantity: number;
    orderedUnitPrice: number;
    receivedQuantity: number;
    invoicedQuantity: number;
    invoicedUnitPrice: number;
    quantityVariance: number;
    priceVariance: number;
  }>;
  totals: {
    poTotal: number;
    invoiceTotal: number;
    receivedValue: number;
    variance: number;
  };
}

export function evaluateThreeWayMatch(input: ThreeWayMatchInput): ThreeWayMatchResult {
  const exceptions: MatchException[] = [];
  const requireReceipt = input.requireReceipt ?? true;

  const poItemIds = new Set<string>();
  for (const item of input.purchaseOrder.items) {
    if (poItemIds.has(item.id)) {
      exceptions.push({
        code: 'DUPLICATE_PO_LINE',
        severity: 'BLOCKING',
        message: 'Purchase order contains duplicate item identifiers',
        details: { purchaseOrderItemId: item.id },
      });
    }
    poItemIds.add(item.id);
  }
  const receivedByLine = new Map<string, number>();
  for (const item of input.receiptItems) {
    const received = num(item.receivedQuantity);
    const rejected = num(item.rejectedQuantity);
    const valid = item.receivedQuantity !== null && item.receivedQuantity !== undefined
      && item.rejectedQuantity !== null && item.rejectedQuantity !== undefined
      && Number.isFinite(received) && Number.isFinite(rejected)
      && received >= 0 && rejected >= 0 && rejected <= received;
    if (!valid) {
      exceptions.push({
        code: 'INVALID_RECEIPT_QUANTITY',
        severity: 'BLOCKING',
        message: 'Goods receipt contains invalid received or rejected quantities',
        details: { purchaseOrderItemId: item.purchaseOrderItemId },
      });
      continue;
    }
    if (item.purchaseOrderItemId && !poItemIds.has(item.purchaseOrderItemId)) {
      exceptions.push({
        code: 'UNMATCHED_RECEIPT_LINE',
        severity: 'BLOCKING',
        message: 'Goods receipt references an item outside this purchase order',
        details: { purchaseOrderItemId: item.purchaseOrderItemId },
      });
      continue;
    }
    const net = received - rejected;
    if (!item.purchaseOrderItemId) {
      exceptions.push({
        code: 'UNMATCHED_RECEIPT_LINE',
        severity: 'BLOCKING',
        message: 'Goods receipt is not linked to a purchase order item',
      });
      continue;
    }
    const aggregate = (receivedByLine.get(item.purchaseOrderItemId) ?? 0) + net;
    if (!Number.isFinite(aggregate)) {
      exceptions.push({ code: 'INVALID_RECEIPT_AGGREGATE', severity: 'BLOCKING', message: 'Cumulative goods receipt quantity overflowed', details: { purchaseOrderItemId: item.purchaseOrderItemId } });
      receivedByLine.set(item.purchaseOrderItemId, 0);
      continue;
    }
    receivedByLine.set(item.purchaseOrderItemId, aggregate);
  }

  const invoicedByLine = new Map<string, { quantity: number; unitPrice: number }>();
  const unlinkedInvoiceLines: typeof input.invoice.items = [];
  for (const item of input.invoice.items) {
    const quantity = num(item.quantity);
    const price = num(item.unitPrice);
    if (item.quantity === null || item.quantity === undefined || item.unitPrice === null || item.unitPrice === undefined
      || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) {
      exceptions.push({
        code: 'INVALID_INVOICE_QUANTITY',
        severity: 'BLOCKING',
        message: 'Invoice contains invalid quantities or unit prices',
        details: { purchaseOrderItemId: item.purchaseOrderItemId },
      });
      continue;
    }
    if (item.purchaseOrderItemId && !poItemIds.has(item.purchaseOrderItemId)) {
      exceptions.push({
        code: 'UNMATCHED_INVOICE_LINE',
        severity: 'BLOCKING',
        message: 'Invoice references an item outside this purchase order',
        details: { purchaseOrderItemId: item.purchaseOrderItemId },
      });
      continue;
    }
    if (!item.purchaseOrderItemId) {
      unlinkedInvoiceLines.push(item);
      continue;
    }
    const existing = invoicedByLine.get(item.purchaseOrderItemId);
    if (existing && Math.abs(existing.unitPrice - price) > MONEY_EPSILON) {
      exceptions.push({
        code: 'CONFLICTING_INVOICE_PRICES',
        severity: 'BLOCKING',
        message: 'Invoice lines for the same purchase order item have conflicting unit prices',
        details: { purchaseOrderItemId: item.purchaseOrderItemId },
      });
      continue;
    }
    const aggregate = (existing?.quantity ?? 0) + quantity;
    if (!Number.isFinite(aggregate)) {
      exceptions.push({ code: 'INVALID_INVOICE_AGGREGATE', severity: 'BLOCKING', message: 'Cumulative invoice quantity overflowed', details: { purchaseOrderItemId: item.purchaseOrderItemId } });
      invoicedByLine.set(item.purchaseOrderItemId, { quantity: 0, unitPrice: price });
      continue;
    }
    invoicedByLine.set(item.purchaseOrderItemId, { quantity: aggregate, unitPrice: price });
  }

  if (input.purchaseOrder.currency !== input.invoice.currency) {
    exceptions.push({
      code: 'CURRENCY_MISMATCH',
      severity: 'BLOCKING',
      message: `Invoice currency ${input.invoice.currency} does not match purchase order currency ${input.purchaseOrder.currency}`,
      details: { poCurrency: input.purchaseOrder.currency, invoiceCurrency: input.invoice.currency },
    });
  }

  const rawTotalReceived = [...receivedByLine.values()].reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(rawTotalReceived)) {
    exceptions.push({ code: 'INVALID_RECEIPT_TOTAL', severity: 'BLOCKING', message: 'Goods receipt quantities overflowed across purchase order lines' });
  }
  const totalReceived = Number.isFinite(rawTotalReceived) ? rawTotalReceived : 0;
  if (requireReceipt && totalReceived <= QTY_EPSILON) {
    exceptions.push({
      code: 'MISSING_RECEIPT',
      severity: 'BLOCKING',
      message: 'No goods receipt has been recorded for this purchase order',
    });
  }

  for (const sibling of input.siblingInvoices) {
    if (sibling.id === input.invoice.id) continue;
    // Legacy invoice rows may predate monetary input validation. An invalid
    // sibling total must not evade duplicate-invoice review via NaN comparisons.
    const siblingTotal = num(sibling.total);
    if (sibling.total === null || sibling.total === undefined || !Number.isFinite(siblingTotal) || siblingTotal < 0) {
      exceptions.push({
        code: 'INVALID_SIBLING_INVOICE_TOTAL',
        severity: 'BLOCKING',
        message: 'Another supplier invoice has an invalid total',
        details: { siblingInvoiceId: sibling.id },
      });
    }
    if (sibling.invoiceNumber === input.invoice.invoiceNumber) {
      exceptions.push({
        code: 'DUPLICATE_INVOICE',
        severity: 'BLOCKING',
        message: `Invoice number ${input.invoice.invoiceNumber} already exists for this supplier`,
        details: { duplicateInvoiceId: sibling.id },
      });
      continue;
    }
    if (
      sibling.purchaseOrderId === input.purchaseOrder.id &&
      Math.abs(num(sibling.total) - num(input.invoice.total)) <= MONEY_EPSILON
    ) {
      exceptions.push({
        code: 'DUPLICATE_INVOICE',
        severity: 'WARNING',
        message: `Another invoice (${sibling.invoiceNumber}) with an identical total already exists for this purchase order`,
        details: { duplicateInvoiceId: sibling.id },
      });
    }
  }

  const lines = input.purchaseOrder.items.map((poItem) => {
    const rawOrdered = num(poItem.quantity);
    const rawUnitPrice = num(poItem.unitPrice);
    if (poItem.quantity === null || poItem.quantity === undefined || poItem.unitPrice === null || poItem.unitPrice === undefined || !Number.isFinite(rawOrdered) || rawOrdered < 0 || !Number.isFinite(rawUnitPrice) || rawUnitPrice < 0) {
      exceptions.push({
        code: 'INVALID_PO_LINE',
        severity: 'BLOCKING',
        message: 'Purchase order contains an invalid quantity or unit price',
        details: { purchaseOrderItemId: poItem.id },
      });
    }
    // Historical corrupt PO rows must not yield NaN/Infinity in match output.
    const ordered = Number.isFinite(rawOrdered) && rawOrdered >= 0 ? rawOrdered : 0;
    const orderedUnitPrice = Number.isFinite(rawUnitPrice) && rawUnitPrice >= 0 ? rawUnitPrice : 0;
    const received = receivedByLine.get(poItem.id) ?? 0;
    if (Number.isFinite(ordered) && ordered >= 0 && received > ordered + QTY_EPSILON) {
      exceptions.push({
        code: 'OVER_RECEIPT',
        severity: 'BLOCKING',
        message: `Cumulative received quantity (${received}) exceeds ordered quantity (${ordered}) for ${poItem.name}`,
        details: { purchaseOrderItemId: poItem.id, ordered, received },
      });
    }
    const invoiced = invoicedByLine.get(poItem.id);
    const invoicedQuantity = invoiced?.quantity ?? 0;
    const invoicedUnitPrice = invoiced?.unitPrice ?? 0;

    if (invoicedQuantity > ordered + QTY_EPSILON) {
      exceptions.push({
        code: 'QUANTITY_MISMATCH',
        severity: 'BLOCKING',
        message: `Invoiced quantity (${invoicedQuantity}) exceeds ordered quantity (${ordered}) for ${poItem.name}`,
        details: { purchaseOrderItemId: poItem.id, ordered, invoiced: invoicedQuantity },
      });
    } else if (invoicedQuantity > received + QTY_EPSILON) {
      exceptions.push({
        code: 'QUANTITY_MISMATCH',
        severity: 'BLOCKING',
        message: `Invoiced quantity (${invoicedQuantity}) exceeds received quantity (${received}) for ${poItem.name}`,
        details: { purchaseOrderItemId: poItem.id, received, invoiced: invoicedQuantity },
      });
    }

    if (invoicedQuantity > QTY_EPSILON && Math.abs(invoicedUnitPrice - orderedUnitPrice) > MONEY_EPSILON) {
      exceptions.push({
        code: 'PRICE_MISMATCH',
        severity: 'BLOCKING',
        message: `Invoiced unit price (${invoicedUnitPrice}) differs from ordered unit price (${orderedUnitPrice}) for ${poItem.name}`,
        details: { purchaseOrderItemId: poItem.id, ordered: orderedUnitPrice, invoiced: invoicedUnitPrice },
      });
    }

    return {
      purchaseOrderItemId: poItem.id,
      name: poItem.name,
      orderedQuantity: ordered,
      orderedUnitPrice,
      receivedQuantity: received,
      invoicedQuantity,
      invoicedUnitPrice,
      quantityVariance: round2(invoicedQuantity - received),
      priceVariance: round2(invoicedUnitPrice - orderedUnitPrice),
    };
  });

  for (const orphan of unlinkedInvoiceLines) {
    exceptions.push({
      code: 'UNMATCHED_INVOICE_LINE',
      severity: 'BLOCKING',
      message: `Invoice line "${orphan.description}" is not linked to any purchase order line`,
      details: { quantity: num(orphan.quantity), unitPrice: num(orphan.unitPrice) },
    });
  }

  // Legacy persisted documents may predate validation. Fail closed and keep
  // all derived totals finite rather than propagating NaN/Infinity to approvals.
  const rawPoTotal = num(input.purchaseOrder.total);
  const rawInvoiceTotal = num(input.invoice.total);
  const rawSubtotal = num(input.invoice.subtotal);
  const rawTax = num(input.invoice.tax);
  if (input.purchaseOrder.total === null || input.purchaseOrder.total === undefined || !Number.isFinite(rawPoTotal) || rawPoTotal < 0) {
    exceptions.push({ code: 'INVALID_PO_TOTAL', severity: 'BLOCKING', message: 'Purchase order total is invalid' });
  }
  if ([input.invoice.total, input.invoice.subtotal, input.invoice.tax].some((value) => value === null || value === undefined) || [rawInvoiceTotal, rawSubtotal, rawTax].some((value) => !Number.isFinite(value) || value < 0)) {
    exceptions.push({ code: 'INVALID_INVOICE_TOTAL', severity: 'BLOCKING', message: 'Invoice totals or tax are invalid' });
  }
  const poTotal = Number.isFinite(rawPoTotal) && rawPoTotal >= 0 ? rawPoTotal : 0;
  const invoiceTotal = Number.isFinite(rawInvoiceTotal) && rawInvoiceTotal >= 0 ? rawInvoiceTotal : 0;
  if (invoiceTotal > poTotal + MONEY_EPSILON) {
    exceptions.push({
      code: 'OVER_INVOICING',
      severity: 'BLOCKING',
      message: `Invoice total (${invoiceTotal}) exceeds purchase order total (${poTotal})`,
      details: { poTotal, invoiceTotal },
    });
  }

  // Persisted legacy rows can contain nonfinite values or finite operands whose
  // product/sum overflows. Never let NaN bypass the subtotal mismatch comparison.
  let subtotalInvalid = false;
  let subtotalAccumulator = new Prisma.Decimal(0);
  for (const item of input.invoice.items) {
    const quantity = num(item.quantity);
    const price = num(item.unitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(price) || quantity < 0 || price < 0) {
      subtotalInvalid = true;
      continue;
    }
    subtotalAccumulator = subtotalAccumulator.plus(new Prisma.Decimal(quantity).mul(price));
  }
  const computedSubtotalRaw = subtotalAccumulator.toNumber();
  if (!Number.isFinite(computedSubtotalRaw)) subtotalInvalid = true;
  if (subtotalInvalid) {
    exceptions.push({
      code: 'INVALID_INVOICE_SUBTOTAL',
      severity: 'BLOCKING',
      message: 'Invoice line arithmetic contains invalid or overflowing values',
    });
  }
  const computedSubtotal = subtotalInvalid ? 0 : round2(computedSubtotalRaw);
  const declaredSubtotal = Number.isFinite(rawSubtotal) && rawSubtotal >= 0 ? rawSubtotal : 0;
  if (Math.abs(computedSubtotal - declaredSubtotal) > MONEY_EPSILON) {
    exceptions.push({
      code: 'PRICE_MISMATCH',
      severity: 'BLOCKING',
      message: `Invoice subtotal (${declaredSubtotal}) does not equal the sum of its line items (${computedSubtotal})`,
      details: { declaredSubtotal, computedSubtotal },
    });
  }

  const rawReceivedValue = lines.reduce((sum, line) => sum.plus(new Prisma.Decimal(line.receivedQuantity).mul(line.orderedUnitPrice)), new Prisma.Decimal(0));
  const receivedValue = rawReceivedValue.toNumber();
  if (!Number.isFinite(receivedValue)) {
    exceptions.push({ code: 'INVALID_RECEIVED_VALUE', severity: 'BLOCKING', message: 'Received goods value overflowed' });
  }

  const blocking = exceptions.filter((exception) => exception.severity === 'BLOCKING').length;
  const warnings = exceptions.length - blocking;

  return {
    matched: blocking === 0,
    blocking,
    warnings,
    exceptions,
    lines,
    totals: {
      poTotal: round2(poTotal),
      invoiceTotal: round2(invoiceTotal),
      receivedValue: Number.isFinite(receivedValue) ? round2(receivedValue) : 0,
      variance: round2(invoiceTotal - poTotal),
    },
  };
}

export function httpError(status: number, message: string) {
  const error: Error & { status?: number } = new Error(message);
  error.status = status;
  return error;
}
