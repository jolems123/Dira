import { Prisma } from '@prisma/client';

export type Decimalish = Prisma.Decimal | number | string | null | undefined;

export function num(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function round2(value: number): number {
  return Number(value.toFixed(2));
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

  const receivedByLine = new Map<string, number>();
  let unlinkedReceived = 0;
  for (const item of input.receiptItems) {
    const net = num(item.receivedQuantity) - num(item.rejectedQuantity);
    if (!item.purchaseOrderItemId) {
      unlinkedReceived += net;
      continue;
    }
    receivedByLine.set(item.purchaseOrderItemId, (receivedByLine.get(item.purchaseOrderItemId) ?? 0) + net);
  }

  const invoicedByLine = new Map<string, { quantity: number; unitPrice: number }>();
  const unlinkedInvoiceLines: typeof input.invoice.items = [];
  for (const item of input.invoice.items) {
    if (!item.purchaseOrderItemId) {
      unlinkedInvoiceLines.push(item);
      continue;
    }
    const existing = invoicedByLine.get(item.purchaseOrderItemId);
    invoicedByLine.set(item.purchaseOrderItemId, {
      quantity: (existing?.quantity ?? 0) + num(item.quantity),
      unitPrice: num(item.unitPrice),
    });
  }

  if (input.purchaseOrder.currency !== input.invoice.currency) {
    exceptions.push({
      code: 'CURRENCY_MISMATCH',
      severity: 'BLOCKING',
      message: `Invoice currency ${input.invoice.currency} does not match purchase order currency ${input.purchaseOrder.currency}`,
      details: { poCurrency: input.purchaseOrder.currency, invoiceCurrency: input.invoice.currency },
    });
  }

  const totalReceived = [...receivedByLine.values()].reduce((sum, value) => sum + value, 0) + unlinkedReceived;
  if (requireReceipt && totalReceived <= QTY_EPSILON) {
    exceptions.push({
      code: 'MISSING_RECEIPT',
      severity: 'BLOCKING',
      message: 'No goods receipt has been recorded for this purchase order',
    });
  }

  for (const sibling of input.siblingInvoices) {
    if (sibling.id === input.invoice.id) continue;
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
    const ordered = num(poItem.quantity);
    const orderedUnitPrice = num(poItem.unitPrice);
    const received = receivedByLine.get(poItem.id) ?? 0;
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

  const poTotal = num(input.purchaseOrder.total);
  const invoiceTotal = num(input.invoice.total);
  if (invoiceTotal > poTotal + MONEY_EPSILON) {
    exceptions.push({
      code: 'OVER_INVOICING',
      severity: 'BLOCKING',
      message: `Invoice total (${invoiceTotal}) exceeds purchase order total (${poTotal})`,
      details: { poTotal, invoiceTotal },
    });
  }

  const computedSubtotal = round2(
    input.invoice.items.reduce((sum, item) => sum + num(item.quantity) * num(item.unitPrice), 0),
  );
  const declaredSubtotal = num(input.invoice.subtotal);
  if (Math.abs(computedSubtotal - declaredSubtotal) > MONEY_EPSILON) {
    exceptions.push({
      code: 'PRICE_MISMATCH',
      severity: 'BLOCKING',
      message: `Invoice subtotal (${declaredSubtotal}) does not equal the sum of its line items (${computedSubtotal})`,
      details: { declaredSubtotal, computedSubtotal },
    });
  }

  const receivedValue = round2(
    lines.reduce((sum, line) => sum + line.receivedQuantity * line.orderedUnitPrice, 0),
  );

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
      receivedValue,
      variance: round2(invoiceTotal - poTotal),
    },
  };
}

export function httpError(status: number, message: string) {
  const error: Error & { status?: number } = new Error(message);
  error.status = status;
  return error;
}
