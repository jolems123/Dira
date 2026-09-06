import { prisma } from '../db';
import { evaluateThreeWayMatch, num } from './procurement-rules';

/**
 * Loads a purchase order, its RECEIPT-kind deliveries and the invoice, then runs the
 * three-way match. Returns null when the invoice does not exist or is out of scope.
 */
export async function runThreeWayMatch(invoiceId: string, organizationId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      OR: [{ buyerOrganizationId: organizationId }, { supplierOrganizationId: organizationId }],
    },
    include: {
      items: true,
      purchaseOrder: { include: { items: true, deliveries: { include: { items: true } } } },
    },
  });
  if (!invoice) return null;
  if (!invoice.purchaseOrder) {
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      purchaseOrderId: null,
      result: {
        matched: false,
        blocking: 1,
        warnings: 0,
        exceptions: [{ code: 'MISSING_PURCHASE_ORDER', severity: 'BLOCKING' as const, message: 'Invoice is not linked to a purchase order' }],
        lines: [],
        totals: { poTotal: 0, invoiceTotal: num(invoice.total), receivedValue: 0, variance: num(invoice.total) },
      },
    };
  }

  const siblingInvoices = await prisma.invoice.findMany({
    where: { supplierOrganizationId: invoice.supplierOrganizationId, id: { not: invoice.id }, status: { not: 'VOID' } },
    select: { id: true, invoiceNumber: true, total: true, purchaseOrderId: true },
  });

  const receiptItems = invoice.purchaseOrder.deliveries
    .filter((delivery) => delivery.kind === 'RECEIPT')
    .flatMap((delivery) => delivery.items);

  const result = evaluateThreeWayMatch({
    purchaseOrder: {
      id: invoice.purchaseOrder.id,
      poNumber: invoice.purchaseOrder.poNumber,
      currency: invoice.purchaseOrder.currency,
      total: invoice.purchaseOrder.total,
      items: invoice.purchaseOrder.items,
    },
    receiptItems,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      currency: invoice.currency,
      total: invoice.total,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      items: invoice.items,
    },
    siblingInvoices,
  });

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceStatus: invoice.status,
    purchaseOrderId: invoice.purchaseOrder.id,
    poNumber: invoice.purchaseOrder.poNumber,
    result,
  };
}
