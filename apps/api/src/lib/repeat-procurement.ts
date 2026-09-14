import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { logger } from './logger';
import { addDays, advanceSchedule, calculateTotals, num } from './procurement-rules';

type Db = Prisma.TransactionClient;

export interface DraftItem {
  name: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  categoryId?: string | null;
  estimatedUnitPrice?: number | null;
  specifications?: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Date.now() alone collides when a scheduler run drafts several requests in the same millisecond. */
export function documentNumber(prefix: string) {
  return `${prefix}-${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

/** VAT-inclusive budget from estimated unit prices; undefined when no line is priced. */
export function estimateBudget(items: DraftItem[]): number | undefined {
  if (!items.some((item) => item.estimatedUnitPrice !== undefined && item.estimatedUnitPrice !== null)) return undefined;
  return calculateTotals({ lines: items.map((item) => ({ quantity: item.quantity, unitPrice: item.estimatedUnitPrice })) }).total;
}

export function toDraftItems(items: Array<{ name: string; description: string | null; quantity: Prisma.Decimal; unit: string | null; categoryId: string | null; estimatedUnitPrice: Prisma.Decimal | null; specifications: string | null }>): DraftItem[] {
  return items.map((item) => ({
    name: item.name,
    description: item.description,
    quantity: num(item.quantity),
    unit: item.unit,
    categoryId: item.categoryId,
    estimatedUnitPrice: item.estimatedUnitPrice === null ? null : num(item.estimatedUnitPrice),
    specifications: item.specifications,
  }));
}

/** Most recent unit price this organisation actually paid for each item name, from non-cancelled purchase orders. */
export async function latestPaidPrices(organizationId: string, names: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(names)];
  if (unique.length === 0) return new Map();
  const rows = await prisma.purchaseOrderItem.findMany({
    where: { name: { in: unique }, purchaseOrder: { buyerOrganizationId: organizationId, status: { not: 'CANCELLED' } } },
    select: { name: true, unitPrice: true },
    orderBy: { purchaseOrder: { createdAt: 'desc' } },
  });
  const prices = new Map<string, number>();
  for (const row of rows) if (!prices.has(row.name)) prices.set(row.name, num(row.unitPrice));
  return prices;
}

export async function withLatestPrices(organizationId: string, items: DraftItem[]) {
  const prices = await latestPaidPrices(organizationId, items.map((item) => item.name));
  return items.map((item) => ({ ...item, estimatedUnitPrice: prices.get(item.name) ?? item.estimatedUnitPrice ?? null }));
}

export async function createDraftRequest(db: Db, input: {
  organizationId: string;
  requestedBy?: string;
  title: string;
  description?: string | null;
  department?: string | null;
  currency: string;
  requiredBy?: Date;
  items: DraftItem[];
  sourceRequestId?: string;
  templateId?: string;
}) {
  return db.purchaseRequest.create({
    data: {
      organizationId: input.organizationId,
      requestNumber: documentNumber('PR'),
      title: input.title,
      description: input.description ?? undefined,
      department: input.department ?? undefined,
      currency: input.currency,
      estimatedBudget: estimateBudget(input.items),
      requiredBy: input.requiredBy,
      requestedBy: input.requestedBy,
      sourceRequestId: input.sourceRequestId,
      templateId: input.templateId,
      items: {
        create: input.items.map((item) => ({
          name: item.name,
          description: item.description ?? undefined,
          quantity: item.quantity,
          unit: item.unit ?? undefined,
          categoryId: item.categoryId ?? undefined,
          estimatedUnitPrice: item.estimatedUnitPrice ?? undefined,
          specifications: item.specifications ?? undefined,
        })),
      },
    },
    include: { items: true },
  });
}

/** Copies a past request into a new draft with last-paid prices and the same lead time. */
export async function repeatRequest(organizationId: string, requestedBy: string, sourceId: string) {
  const source = await prisma.purchaseRequest.findFirst({ where: { id: sourceId, organizationId }, include: { items: true } });
  if (!source) return null;
  const items = await withLatestPrices(organizationId, toDraftItems(source.items));
  const leadDays = source.requiredBy ? Math.max(0, Math.round((source.requiredBy.getTime() - source.createdAt.getTime()) / DAY_MS)) : null;
  return createDraftRequest(prisma, {
    organizationId,
    requestedBy,
    title: source.title,
    description: source.description,
    department: source.department,
    currency: source.currency,
    requiredBy: leadDays === null ? undefined : addDays(new Date(), leadDays),
    items,
    sourceRequestId: source.id,
    templateId: source.templateId ?? undefined,
  });
}

export async function requestFromTemplate(db: Db, templateId: string, organizationId: string, requestedBy?: string) {
  const template = await db.procurementTemplate.findFirst({ where: { id: templateId, organizationId }, include: { items: true } });
  if (!template) return null;
  const items = await withLatestPrices(organizationId, toDraftItems(template.items));
  return createDraftRequest(db, {
    organizationId,
    requestedBy,
    title: template.title,
    description: template.description,
    department: template.department,
    currency: template.currency,
    requiredBy: template.leadTimeDays === null ? undefined : addDays(new Date(), template.leadTimeDays),
    items,
    templateId: template.id,
  });
}

/**
 * Suppliers to pre-select when sourcing a repeated request: everyone invited on earlier rounds of the
 * same purchase (the repeat chain or other requests from the same template) plus template favourites.
 */
export async function supplierSuggestions(organizationId: string, requestId: string) {
  const request = await prisma.purchaseRequest.findFirst({
    where: { id: requestId, organizationId },
    select: { id: true, sourceRequestId: true, templateId: true, template: { select: { preferredSupplierIds: true } } },
  });
  if (!request) return null;

  const relatedIds: string[] = [];
  let cursor = request.sourceRequestId;
  while (cursor && relatedIds.length < 10 && !relatedIds.includes(cursor)) {
    relatedIds.push(cursor);
    const parent = await prisma.purchaseRequest.findFirst({ where: { id: cursor, organizationId }, select: { sourceRequestId: true } });
    cursor = parent?.sourceRequestId ?? null;
  }
  if (request.templateId) {
    const siblings = await prisma.purchaseRequest.findMany({
      where: { organizationId, templateId: request.templateId, id: { not: request.id } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    for (const sibling of siblings) if (!relatedIds.includes(sibling.id)) relatedIds.push(sibling.id);
  }

  const rfqs = relatedIds.length === 0 ? [] : await prisma.rFQ.findMany({
    where: { organizationId, purchaseRequestId: { in: relatedIds } },
    select: { suppliers: { select: { supplierId: true } }, purchaseOrders: { where: { status: { not: 'CANCELLED' } }, select: { supplierOrganizationId: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });

  const candidateIds = [...new Set([...(request.template?.preferredSupplierIds ?? []), ...rfqs.flatMap((rfq) => rfq.suppliers.map((supplier) => supplier.supplierId))])];
  const valid = candidateIds.length === 0 ? [] : await prisma.organization.findMany({
    where: { id: { in: candidateIds }, type: { in: ['SUPPLIER', 'BOTH'] } },
    select: { id: true },
  });
  const validIds = new Set(valid.map((supplier) => supplier.id));
  const lastAwardedSupplierId = rfqs.find((rfq) => rfq.purchaseOrders.length > 0)?.purchaseOrders[0].supplierOrganizationId ?? null;

  return {
    supplierIds: candidateIds.filter((id) => validIds.has(id)),
    lastAwardedSupplierId: lastAwardedSupplierId && validIds.has(lastAwardedSupplierId) ? lastAwardedSupplierId : null,
    basedOn: request.sourceRequestId ? 'REPEAT' as const : request.templateId ? 'TEMPLATE' as const : null,
  };
}

/** Drafts one request for every schedule that has come due. Safe to run concurrently from several API instances. */
export async function runDueSchedules(now = new Date()) {
  const due = await prisma.procurementTemplate.findMany({
    where: { scheduleActive: true, frequency: { not: null }, nextRunAt: { lte: now } },
    select: { id: true, name: true, organizationId: true, createdBy: true, frequency: true, nextRunAt: true },
    take: 100,
  });

  const created = [];
  for (const template of due) {
    const nextRunAt = advanceSchedule(template.nextRunAt!, template.frequency!, now);
    try {
      const request = await prisma.$transaction(async (tx) => {
        // The conditional update claims this period; a concurrent runner sees count 0 and skips it.
        const claim = await tx.procurementTemplate.updateMany({
          where: { id: template.id, scheduleActive: true, nextRunAt: template.nextRunAt },
          data: { nextRunAt, lastRunAt: now },
        });
        if (claim.count === 0) return null;
        const draft = await requestFromTemplate(tx, template.id, template.organizationId, template.createdBy ?? undefined);
        if (!draft) return null;
        await tx.notification.create({
          data: {
            userId: template.createdBy,
            type: 'SCHEDULED_REQUEST_DRAFTED',
            title: `${draft.requestNumber} drafted from "${template.name}"`,
            body: 'Review the quantities and prices, then submit it for approval.',
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: template.organizationId,
            action: 'SCHEDULED_REQUEST_DRAFTED',
            entityType: 'PurchaseRequest',
            entityId: draft.id,
            metadata: { templateId: template.id, nextRunAt: nextRunAt.toISOString() },
          },
        });
        return draft;
      });
      if (request) created.push(request);
    } catch (error) {
      logger.error({ err: error, templateId: template.id }, 'Scheduled purchase request failed');
    }
  }
  return created;
}

export function startScheduler(intervalMs = 15 * 60 * 1000) {
  const tick = () => {
    runDueSchedules()
      .then((created) => { if (created.length > 0) logger.info({ count: created.length }, 'Drafted scheduled purchase requests'); })
      .catch((error) => logger.error({ err: error }, 'Schedule run failed'));
  };
  tick();
  const handle = setInterval(tick, intervalMs);
  handle.unref();
  return handle;
}
