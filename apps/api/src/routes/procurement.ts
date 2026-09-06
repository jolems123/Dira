import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth';
import {
  INVOICE_TRANSITIONS,
  PO_TRANSITIONS,
  QTY_EPSILON,
  QUOTE_TRANSITIONS,
  assertTransition,
  isQuoteExpired,
  num,
  round2,
} from '../lib/procurement-rules';
import { runThreeWayMatch } from '../lib/three-way-match';

const requestSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  department: z.string().min(2),
  currency: z.string().length(3).default('BWP'),
  requiredBy: z.string().datetime().optional(),
  estimatedBudget: z.number().nonnegative().optional(),
  items: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().positive(),
    unit: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    estimatedUnitPrice: z.number().nonnegative().optional(),
    specifications: z.string().optional(),
  })).min(1),
});

const approvalSchema = z.object({
  comment: z.string().max(500).optional(),
});

const createRfqSchema = z.object({
  purchaseRequestId: z.string().min(1),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  quoteDeadline: z.string().datetime(),
  requiredBy: z.string().datetime().optional(),
  budget: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('BWP'),
  supplierIds: z.array(z.string().min(1)).min(1),
});

const submitQuotationSchema = z.object({
  currency: z.string().length(3).default('BWP'),
  tax: z.number().nonnegative().default(0),
  deliveryFee: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  deliveryDays: z.number().int().nonnegative().optional(),
  paymentTerms: z.string().max(200).optional(),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(3000).optional(),
  items: z.array(z.object({
    rfqItemId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    notes: z.string().max(1000).optional(),
  })).min(1),
});

const awardQuotationSchema = z.object({
  quotationId: z.string().min(1),
  awardReason: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
  deliveryAddress: z.string().max(500).optional(),
  paymentTerms: z.string().max(200).optional(),
});

const acknowledgePoSchema = z.object({
  notes: z.string().max(500).optional(),
});

const dispatchSchema = z.object({
  dispatchReference: z.string().min(1).max(120),
  expectedDeliveryDate: z.string().datetime().optional(),
  deliveryNote: z.string().max(1000).optional(),
  attachmentKey: z.string().max(300).optional(),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().min(1),
    quantity: z.number().positive(),
  })).min(1),
});

const goodsReceiptSchema = z.object({
  dispatchReference: z.string().max(120).optional(),
  deliveryNoteReference: z.string().max(120).optional(),
  deliveryNote: z.string().max(1000).optional(),
  attachmentKey: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().min(1),
    receivedQuantity: z.number().nonnegative(),
    rejectedQuantity: z.number().nonnegative().default(0),
    condition: z.string().max(200).optional(),
  })).min(1),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  poId: z.string().min(1),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  currency: z.string().length(3).default('BWP'),
  tax: z.number().nonnegative().default(0),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().min(1).optional(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
  })).min(1),
  attachmentKey: z.string().max(300).optional(),
  attachmentUrl: z.string().url().optional(),
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION']),
  reason: z.string().max(500).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('BWP'),
  paymentDate: z.string().datetime(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'MOBILE_MONEY', 'CARD', 'OTHER']),
  reference: z.string().min(1),
  notes: z.string().max(500).optional(),
});

async function recordAudit({
  organizationId,
  userId,
  action,
  entityType,
  entityId,
  before,
  after,
  metadata,
}: {
  organizationId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      action,
      entityType,
      entityId,
      before: before as any,
      after: after as any,
      metadata: metadata as any,
    },
  });
}

export const procurementRouter = Router();
procurementRouter.use(requireAuth);

procurementRouter.get('/categories', async (_req, res, next) => {
  try { return res.json({ items: await prisma.category.findMany({ orderBy: { name: 'asc' } }) }); } catch (error) { return next(error); }
});

procurementRouter.get('/purchase-requests', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const items = await prisma.purchaseRequest.findMany({ where: { organizationId: req.user.organizationId }, orderBy: { createdAt: 'desc' }, include: { items: true } });
    return res.json({ items });
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-requests', requireRole('OWNER', 'ADMIN', 'REQUESTER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const request = await prisma.purchaseRequest.create({
      data: {
        organizationId: req.user.organizationId,
        requestNumber: `PR-${Date.now()}`,
        title: parsed.data.title,
        description: parsed.data.description,
        department: parsed.data.department,
        currency: parsed.data.currency,
        estimatedBudget: parsed.data.estimatedBudget,
        requiredBy: parsed.data.requiredBy ? new Date(parsed.data.requiredBy) : undefined,
        requestedBy: req.user.id,
        items: { create: parsed.data.items },
      },
      include: { items: true },
    });
    return res.status(201).json(request);
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-requests/:id/submit', requireRole('OWNER', 'ADMIN', 'REQUESTER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const request = await prisma.purchaseRequest.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
    if (!request) return res.status(404).json({ message: 'Purchase request not found' });
    if (request.status !== 'DRAFT') return res.status(409).json({ message: `Cannot submit a ${request.status.toLowerCase()} request` });
    const updated = await prisma.purchaseRequest.update({ where: { id: request.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-requests/:id/approve', requireRole('OWNER', 'ADMIN', 'APPROVER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = approvalSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const request = await prisma.purchaseRequest.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
    if (!request) return res.status(404).json({ message: 'Purchase request not found' });
    if (request.status !== 'SUBMITTED') return res.status(409).json({ message: `Cannot approve a ${request.status.toLowerCase()} request` });
    const [, updated] = await prisma.$transaction([
      prisma.approvalDecision.create({
        data: {
          purchaseRequestId: request.id,
          approverUserId: req.user!.id,
          decision: 'APPROVED',
          comment: parsed.data.comment,
        },
      }),
      prisma.purchaseRequest.update({
        where: { id: request.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      }),
    ]);
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-requests/:id/reject', requireRole('OWNER', 'ADMIN', 'APPROVER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = approvalSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    const request = await prisma.purchaseRequest.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.organizationId } });
    if (!request) return res.status(404).json({ message: 'Purchase request not found' });
    if (request.status !== 'SUBMITTED') return res.status(409).json({ message: `Cannot reject a ${request.status.toLowerCase()} request` });
    const [, updated] = await prisma.$transaction([
      prisma.approvalDecision.create({
        data: {
          purchaseRequestId: request.id,
          approverUserId: req.user!.id,
          decision: 'REJECTED',
          comment: parsed.data.comment,
        },
      }),
      prisma.purchaseRequest.update({
        where: { id: request.id },
        data: { status: 'REJECTED' },
      }),
    ]);
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.get('/rfqs', async (req: AuthenticatedRequest, res, next) => {
  try {
    const items = await prisma.rFQ.findMany({
      where: { organizationId: req.user!.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        suppliers: true,
        purchaseRequest: { select: { id: true, requestNumber: true, title: true } },
      },
    });
    const quoteCounts = items.length === 0
      ? []
      : await prisma.quotation.groupBy({
          by: ['rfqId'],
          where: { rfqId: { in: items.map((item) => item.id) } },
          _count: { _all: true },
        });
    const countByRfqId = new Map(quoteCounts.map((entry) => [entry.rfqId, entry._count._all]));
    return res.json({
      items: items.map((item) => ({
        ...item,
        quoteCount: countByRfqId.get(item.id) ?? 0,
      })),
    });
  } catch (error) { return next(error); }
});

procurementRouter.post('/rfqs', requireRole('OWNER', 'ADMIN', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = createRfqSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const quoteDeadline = new Date(parsed.data.quoteDeadline);
    if (quoteDeadline <= new Date()) return res.status(400).json({ message: 'Quote deadline must be in the future' });

    const purchaseRequest = await prisma.purchaseRequest.findFirst({
      where: { id: parsed.data.purchaseRequestId, organizationId: req.user.organizationId },
      include: { items: true },
    });
    if (!purchaseRequest) return res.status(404).json({ message: 'Purchase request not found' });
    if (!['APPROVED', 'RFQ_CREATED'].includes(purchaseRequest.status)) {
      return res.status(409).json({ message: `RFQ can only be created from approved requests. Current status is ${purchaseRequest.status.toLowerCase()}` });
    }
    if (purchaseRequest.items.length === 0) return res.status(409).json({ message: 'Purchase request has no items' });

    const supplierIds = [...new Set(parsed.data.supplierIds)];
    const suppliers = await prisma.organization.findMany({
      where: {
        id: { in: supplierIds },
        type: { in: ['SUPPLIER', 'BOTH'] },
      },
      select: { id: true },
    });
    if (suppliers.length !== supplierIds.length) return res.status(400).json({ message: 'One or more suppliers are invalid or not supplier organizations' });

    const rfq = await prisma.$transaction(async (tx) => {
      const created = await tx.rFQ.create({
        data: {
          organizationId: req.user!.organizationId!,
          purchaseRequestId: purchaseRequest.id,
          rfqNumber: `RFQ-${Date.now()}`,
          title: parsed.data.title ?? purchaseRequest.title,
          description: parsed.data.description ?? purchaseRequest.description ?? undefined,
          requiredBy: parsed.data.requiredBy ? new Date(parsed.data.requiredBy) : purchaseRequest.requiredBy ?? undefined,
          quoteDeadline,
          budget: parsed.data.budget ?? purchaseRequest.estimatedBudget ?? undefined,
          currency: parsed.data.currency,
          createdBy: req.user!.id,
          status: 'DRAFT',
          items: {
            create: purchaseRequest.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
            })),
          },
          suppliers: {
            create: suppliers.map((supplier) => ({
              supplierId: supplier.id,
            })),
          },
        },
        include: { items: true, suppliers: true },
      });
      await tx.purchaseRequest.update({
        where: { id: purchaseRequest.id },
        data: { status: 'RFQ_CREATED' },
      });
      return created;
    });

    return res.status(201).json(rfq);
  } catch (error) { return next(error); }
});

procurementRouter.post('/rfqs/:id/publish', requireRole('OWNER', 'ADMIN', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const rfq = await prisma.rFQ.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
    });
    if (!rfq) return res.status(404).json({ message: 'RFQ not found' });
    if (rfq.status !== 'DRAFT') return res.status(409).json({ message: `Cannot publish a ${rfq.status.toLowerCase()} RFQ` });
    if (rfq.quoteDeadline && rfq.quoteDeadline <= new Date()) return res.status(400).json({ message: 'Quote deadline must be in the future' });
    const updated = await prisma.rFQ.update({
      where: { id: rfq.id },
      data: {
        status: 'OPEN',
        publishedAt: new Date(),
      },
      include: { items: true, suppliers: true },
    });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.get('/rfqs/:id/quotes', requireRole('OWNER', 'ADMIN', 'PROCUREMENT', 'APPROVER', 'FINANCE', 'VIEWER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const rfq = await prisma.rFQ.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId },
      select: { id: true },
    });
    if (!rfq) return res.status(404).json({ message: 'RFQ not found' });
    const items = await prisma.quotation.findMany({
      where: { rfqId: rfq.id },
      include: {
        items: true,
        organization: {
          select: {
            id: true,
            legalName: true,
            tradingName: true,
            city: true,
            country: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ items });
  } catch (error) { return next(error); }
});

procurementRouter.post('/rfqs/:id/quotes', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = submitQuotationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const rfq = await prisma.rFQ.findUnique({
      where: { id: String(req.params.id) },
      include: { items: true, suppliers: true },
    });
    if (!rfq) return res.status(404).json({ message: 'RFQ not found' });
    if (!['OPEN', 'QUOTES_RECEIVED'].includes(rfq.status)) return res.status(409).json({ message: `Cannot submit a quote for a ${rfq.status.toLowerCase()} RFQ` });
    if (rfq.quoteDeadline && rfq.quoteDeadline <= new Date()) return res.status(409).json({ message: 'Quote deadline has passed' });

    const invitation = rfq.suppliers.find((supplier) => supplier.supplierId === req.user!.organizationId);
    if (!invitation) return res.status(403).json({ message: 'Your organization is not invited to this RFQ' });

    const existingSubmitted = await prisma.quotation.findFirst({
      where: {
        rfqId: rfq.id,
        supplierOrganizationId: req.user.organizationId,
        status: { in: ['SUBMITTED', 'VIEWED', 'REVISED', 'AWARDED', 'ACCEPTED'] },
      },
      select: { id: true },
    });
    if (existingSubmitted) return res.status(409).json({ message: 'A quotation has already been submitted for this RFQ' });

    const validRfqItemIds = new Set(rfq.items.map((item) => item.id));
    for (const item of parsed.data.items) {
      if (!validRfqItemIds.has(item.rfqItemId)) {
        return res.status(400).json({ message: `Invalid RFQ item: ${item.rfqItemId}` });
      }
    }

    const quoteItems = parsed.data.items.map((item) => ({
      rfqItemId: item.rfqItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
      notes: item.notes,
    }));
    const subtotal = Number(quoteItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
    const total = Number((subtotal + parsed.data.tax + parsed.data.deliveryFee - parsed.data.discount).toFixed(2));
    if (total < 0) return res.status(400).json({ message: 'Discount cannot exceed the total before discount' });

    const quotation = await prisma.$transaction(async (tx) => {
      const created = await tx.quotation.create({
        data: {
          quoteNumber: `QT-${Date.now()}`,
          rfqId: rfq.id,
          supplierOrganizationId: req.user!.organizationId!,
          currency: parsed.data.currency,
          subtotal,
          tax: parsed.data.tax,
          deliveryFee: parsed.data.deliveryFee,
          discount: parsed.data.discount,
          total,
          deliveryDays: parsed.data.deliveryDays,
          paymentTerms: parsed.data.paymentTerms,
          validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
          notes: parsed.data.notes,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          items: { create: quoteItems },
        },
        include: { items: true },
      });
      await tx.rFQSupplier.update({
        where: { id: invitation.id },
        data: { responseStatus: 'SUBMITTED', viewedAt: invitation.viewedAt ?? new Date() },
      });
      if (rfq.status === 'OPEN') {
        await tx.rFQ.update({
          where: { id: rfq.id },
          data: { status: 'QUOTES_RECEIVED' },
        });
      }
      return created;
    });
    return res.status(201).json(quotation);
  } catch (error) { return next(error); }
});

procurementRouter.patch('/quotes/:id', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = submitQuotationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const quotation = await prisma.quotation.findFirst({
      where: { id: String(req.params.id), supplierOrganizationId: req.user.organizationId },
      include: { rfq: { include: { items: true } }, items: true },
    });
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    if (['AWARDED', 'ACCEPTED'].includes(quotation.status)) return res.status(409).json({ message: 'An awarded quotation cannot be revised' });
    assertTransition(QUOTE_TRANSITIONS, quotation.status, 'REVISED', 'quotation');
    if (!['OPEN', 'QUOTES_RECEIVED'].includes(quotation.rfq.status)) {
      return res.status(409).json({ message: `Cannot revise a quote for a ${quotation.rfq.status.toLowerCase()} RFQ` });
    }
    if (quotation.rfq.quoteDeadline && quotation.rfq.quoteDeadline <= new Date()) {
      return res.status(409).json({ message: 'Quote deadline has passed' });
    }

    const validRfqItemIds = new Set(quotation.rfq.items.map((item) => item.id));
    for (const item of parsed.data.items) {
      if (!validRfqItemIds.has(item.rfqItemId)) return res.status(400).json({ message: `Invalid RFQ item: ${item.rfqItemId}` });
    }

    const quoteItems = parsed.data.items.map((item) => ({
      rfqItemId: item.rfqItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: round2(item.quantity * item.unitPrice),
      notes: item.notes,
    }));
    const subtotal = round2(quoteItems.reduce((sum, item) => sum + item.subtotal, 0));
    const total = round2(subtotal + parsed.data.tax + parsed.data.deliveryFee - parsed.data.discount);
    if (total < 0) return res.status(400).json({ message: 'Discount cannot exceed the total before discount' });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: quotation.id } });
      return tx.quotation.update({
        where: { id: quotation.id },
        data: {
          currency: parsed.data.currency,
          subtotal,
          tax: parsed.data.tax,
          deliveryFee: parsed.data.deliveryFee,
          discount: parsed.data.discount,
          total,
          deliveryDays: parsed.data.deliveryDays,
          paymentTerms: parsed.data.paymentTerms,
          validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
          notes: parsed.data.notes,
          status: 'REVISED',
          revisedAt: new Date(),
          items: { create: quoteItems },
        },
        include: { items: true },
      });
    });

    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'REVISE_QUOTATION', entityType: 'Quotation', entityId: quotation.id, before: { status: quotation.status, total: num(quotation.total) }, after: { status: 'REVISED', total } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.post('/quotes/:id/withdraw', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const quotation = await prisma.quotation.findFirst({
      where: { id: String(req.params.id), supplierOrganizationId: req.user.organizationId },
    });
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    if (['AWARDED', 'ACCEPTED'].includes(quotation.status)) return res.status(409).json({ message: 'An awarded quotation cannot be withdrawn' });
    assertTransition(QUOTE_TRANSITIONS, quotation.status, 'WITHDRAWN', 'quotation');
    const updated = await prisma.quotation.update({ where: { id: quotation.id }, data: { status: 'WITHDRAWN' } });
    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'WITHDRAW_QUOTATION', entityType: 'Quotation', entityId: quotation.id, before: { status: quotation.status }, after: { status: 'WITHDRAWN' } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.get('/quotes/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: String(req.params.id),
        OR: [{ supplierOrganizationId: orgId }, { rfq: { organizationId: orgId } }],
      },
      include: { items: true, rfq: { select: { id: true, rfqNumber: true, title: true, status: true, organizationId: true } } },
    });
    if (!quotation) return res.status(404).json({ message: 'Quotation not found' });
    return res.json(quotation);
  } catch (error) { return next(error); }
});

procurementRouter.post('/rfqs/:id/award', requireRole('OWNER', 'ADMIN', 'APPROVER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = awardQuotationSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });

    const rfq = await prisma.rFQ.findFirst({
      where: { id: String(req.params.id), organizationId: req.user.organizationId },
      include: { items: true },
    });
    if (!rfq) return res.status(404).json({ message: 'RFQ not found' });
    if (!['QUOTES_RECEIVED', 'EVALUATION'].includes(rfq.status)) {
      return res.status(409).json({ message: `Cannot award a ${rfq.status.toLowerCase()} RFQ` });
    }

    const quotation = await prisma.quotation.findFirst({
      where: { id: parsed.data.quotationId, rfqId: rfq.id },
      include: { items: true },
    });
    if (!quotation) return res.status(404).json({ message: 'Quotation not found for this RFQ' });
    if (['WITHDRAWN', 'REJECTED', 'EXPIRED'].includes(quotation.status)) {
      return res.status(409).json({ message: `Cannot award a ${quotation.status.toLowerCase()} quotation` });
    }
    if (isQuoteExpired(quotation.validUntil)) {
      await prisma.quotation.update({ where: { id: quotation.id }, data: { status: 'EXPIRED' } });
      return res.status(409).json({ message: 'Quotation validity period has expired' });
    }
    assertTransition(QUOTE_TRANSITIONS, quotation.status, 'AWARDED', 'quotation');

    const existingAward = await prisma.quotation.findFirst({
      where: { rfqId: rfq.id, status: { in: ['AWARDED', 'ACCEPTED'] } },
      select: { id: true },
    });
    if (existingAward) return res.status(409).json({ message: 'This RFQ has already been awarded' });

    const existingPurchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { rfqId: rfq.id, status: { not: 'CANCELLED' } },
      select: { id: true },
    });
    if (existingPurchaseOrder) return res.status(409).json({ message: 'A purchase order has already been created for this RFQ' });

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          poNumber: `PO-${Date.now()}`,
          buyerOrganizationId: req.user!.organizationId!,
          supplierOrganizationId: quotation.supplierOrganizationId,
          rfqId: rfq.id,
          quotationId: quotation.id,
          currency: quotation.currency,
          subtotal: quotation.subtotal,
          tax: quotation.tax,
          deliveryFee: quotation.deliveryFee,
          total: quotation.total,
          status: 'ISSUED',
          deliveryAddress: parsed.data.deliveryAddress,
          paymentTerms: parsed.data.paymentTerms ?? quotation.paymentTerms,
          issuedAt: new Date(),
          expectedDeliveryDate: quotation.deliveryDays
            ? new Date(Date.now() + quotation.deliveryDays * 24 * 60 * 60 * 1000)
            : undefined,
          items: {
            create: quotation.items.map((item, index) => ({
              name: rfq.items.find((rfqItem) => rfqItem.id === item.rfqItemId)?.name ?? `Line ${index + 1}`,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      await tx.rFQ.update({ where: { id: rfq.id }, data: { status: 'AWARDED' } });
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          status: 'AWARDED',
          awardedAt: new Date(),
          awardedBy: req.user!.id,
          awardReason: parsed.data.awardReason ?? parsed.data.notes,
        },
      });
      await tx.quotation.updateMany({
        where: { rfqId: rfq.id, id: { not: quotation.id }, status: { in: ['SUBMITTED', 'VIEWED', 'REVISED'] } },
        data: { status: 'REJECTED' },
      });
      return created;
    });

    await recordAudit({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: 'AWARD_QUOTATION',
      entityType: 'Quotation',
      entityId: quotation.id,
      before: { status: quotation.status },
      after: { status: 'AWARDED', purchaseOrderId: purchaseOrder.id },
      metadata: { awardReason: parsed.data.awardReason ?? parsed.data.notes, rfqId: rfq.id },
    });

    return res.status(201).json({ purchaseOrder, notes: parsed.data.notes });
  } catch (error) { return next(error); }
});

procurementRouter.get('/purchase-orders', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const items = await prisma.purchaseOrder.findMany({
      where: { OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        supplier: { select: { id: true, legalName: true } },
        buyer: { select: { id: true, legalName: true } },
        deliveries: { include: { items: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, total: true } },
      },
    });
    return res.json({ items });
  } catch (error) { return next(error); }
});

procurementRouter.get('/purchase-orders/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: String(req.params.id), OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] },
      include: {
        items: true,
        deliveries: { include: { items: true }, orderBy: { createdAt: 'asc' } },
        invoices: { include: { items: true, paymentRecords: true } },
        buyer: { select: { id: true, legalName: true, tradingName: true } },
        supplier: { select: { id: true, legalName: true, tradingName: true } },
      },
    });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });

    const receivedByLine = new Map<string, number>();
    for (const delivery of po.deliveries) {
      if (delivery.kind !== 'RECEIPT') continue;
      for (const item of delivery.items) {
        if (!item.purchaseOrderItemId) continue;
        receivedByLine.set(
          item.purchaseOrderItemId,
          (receivedByLine.get(item.purchaseOrderItemId) ?? 0) + num(item.receivedQuantity) - num(item.rejectedQuantity),
        );
      }
    }
    const lines = po.items.map((item) => {
      const received = receivedByLine.get(item.id) ?? 0;
      return {
        ...item,
        receivedQuantity: round2(received),
        remainingQuantity: round2(Math.max(0, num(item.quantity) - received)),
      };
    });
    return res.json({ ...po, lines });
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-orders/:id/acknowledge', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = acknowledgePoSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const po = await prisma.purchaseOrder.findFirst({ where: { id: String(req.params.id), supplierOrganizationId: req.user.organizationId }, include: { items: true } });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status === 'ACKNOWLEDGED') return res.status(409).json({ message: 'Purchase order has already been acknowledged' });
    assertTransition(PO_TRANSITIONS, po.status, 'ACKNOWLEDGED', 'purchase order');
    const before = { status: po.status };
    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'ACKNOWLEDGED', acceptedAt: new Date() },
      include: { items: true },
    });
    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'ACKNOWLEDGE_PURCHASE_ORDER', entityType: 'PurchaseOrder', entityId: po.id, before, after: { status: updated.status }, metadata: { notes: parsed.data.notes } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-orders/:id/deliveries', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = dispatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: String(req.params.id), supplierOrganizationId: req.user.organizationId },
      include: { items: true, deliveries: { include: { items: true } } },
    });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status === 'CANCELLED') return res.status(409).json({ message: 'Purchase order is cancelled' });
    if (!['ACKNOWLEDGED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(po.status)) {
      return res.status(409).json({ message: 'Purchase order must be acknowledged before dispatch' });
    }

    const orderItemMap = new Map(po.items.map((item) => [item.id, item]));
    const dispatchedByLine = new Map<string, number>();
    for (const delivery of po.deliveries) {
      if (delivery.kind !== 'DISPATCH') continue;
      for (const item of delivery.items) {
        if (!item.purchaseOrderItemId) continue;
        dispatchedByLine.set(item.purchaseOrderItemId, (dispatchedByLine.get(item.purchaseOrderItemId) ?? 0) + num(item.orderedQuantity));
      }
    }

    const duplicateReference = await prisma.delivery.findFirst({
      where: { purchaseOrderId: po.id, dispatchReference: parsed.data.dispatchReference },
      select: { id: true },
    });
    if (duplicateReference) return res.status(409).json({ message: 'Dispatch reference already used for this purchase order' });

    for (const item of parsed.data.items) {
      const orderItem = orderItemMap.get(item.purchaseOrderItemId);
      if (!orderItem) return res.status(400).json({ message: `Unknown purchase order item: ${item.purchaseOrderItemId}` });
      const already = dispatchedByLine.get(item.purchaseOrderItemId) ?? 0;
      if (already + item.quantity > num(orderItem.quantity) + QTY_EPSILON) {
        return res.status(400).json({
          message: `Dispatch quantity exceeds ordered quantity for ${orderItem.name}`,
          details: { ordered: num(orderItem.quantity), alreadyDispatched: already, requested: item.quantity },
        });
      }
    }

    const delivery = await prisma.delivery.create({
      data: {
        purchaseOrderId: po.id,
        kind: 'DISPATCH',
        status: 'DISPATCHED',
        dispatchReference: parsed.data.dispatchReference,
        dispatchDate: new Date(),
        expectedDate: parsed.data.expectedDeliveryDate ? new Date(parsed.data.expectedDeliveryDate) : undefined,
        deliveryNote: parsed.data.deliveryNote,
        attachmentKey: parsed.data.attachmentKey,
        items: {
          create: parsed.data.items.map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            orderedQuantity: item.quantity,
            receivedQuantity: 0,
            rejectedQuantity: 0,
          })),
        },
      },
      include: { items: true },
    });

    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'DISPATCH_PURCHASE_ORDER', entityType: 'Delivery', entityId: delivery.id, before: { purchaseOrderId: po.id, status: po.status }, after: { status: 'DISPATCHED' }, metadata: { dispatchReference: parsed.data.dispatchReference } });
    return res.status(201).json(delivery);
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-orders/:id/goods-receipt', requireRole('OWNER', 'ADMIN', 'PROCUREMENT', 'RECEIVER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = goodsReceiptSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: String(req.params.id), buyerOrganizationId: req.user.organizationId },
      include: { items: true, deliveries: { include: { items: true } } },
    });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status === 'CANCELLED') return res.status(409).json({ message: 'Purchase order is cancelled' });
    if (['CLOSED', 'COMPLETED'].includes(po.status)) return res.status(409).json({ message: 'Purchase order is already closed' });

    const orderItemMap = new Map(po.items.map((item) => [item.id, item]));
    const receivedByLine = new Map<string, number>();
    for (const delivery of po.deliveries) {
      if (delivery.kind !== 'RECEIPT') continue;
      for (const item of delivery.items) {
        if (!item.purchaseOrderItemId) continue;
        receivedByLine.set(
          item.purchaseOrderItemId,
          (receivedByLine.get(item.purchaseOrderItemId) ?? 0) + num(item.receivedQuantity) - num(item.rejectedQuantity),
        );
      }
    }

    if (parsed.data.deliveryNoteReference) {
      const duplicate = await prisma.delivery.findFirst({
        where: { purchaseOrderId: po.id, kind: 'RECEIPT', dispatchReference: parsed.data.deliveryNoteReference },
        select: { id: true },
      });
      if (duplicate) return res.status(409).json({ message: 'A goods receipt with this delivery note reference already exists' });
    }

    const receiptLines: Array<{ purchaseOrderItemId: string; orderedQuantity: number; receivedQuantity: number; rejectedQuantity: number; condition: string }> = [];
    for (const item of parsed.data.items) {
      const orderItem = orderItemMap.get(item.purchaseOrderItemId);
      if (!orderItem) return res.status(400).json({ message: `Unknown purchase order item: ${item.purchaseOrderItemId}` });
      const ordered = num(orderItem.quantity);
      const previously = receivedByLine.get(item.purchaseOrderItemId) ?? 0;
      const net = item.receivedQuantity - item.rejectedQuantity;
      if (net < 0) return res.status(400).json({ message: 'Rejected quantity cannot exceed received quantity' });
      if (previously + net > ordered + QTY_EPSILON) {
        return res.status(400).json({
          message: `Goods receipt exceeds ordered quantity for ${orderItem.name}`,
          details: { ordered, previouslyReceived: previously, receivedNow: net, remaining: round2(Math.max(0, ordered - previously)) },
        });
      }
      receiptLines.push({
        purchaseOrderItemId: item.purchaseOrderItemId,
        orderedQuantity: ordered,
        receivedQuantity: item.receivedQuantity,
        rejectedQuantity: item.rejectedQuantity,
        condition: item.condition ?? 'GOOD',
      });
    }

    const totalOrdered = po.items.reduce((sum, item) => sum + num(item.quantity), 0);
    const totalReceivedAfter = po.items.reduce((sum, item) => {
      const previously = receivedByLine.get(item.id) ?? 0;
      const line = receiptLines.find((candidate) => candidate.purchaseOrderItemId === item.id);
      const now = line ? line.receivedQuantity - line.rejectedQuantity : 0;
      return sum + previously + now;
    }, 0);
    const fullyReceived = totalReceivedAfter >= totalOrdered - QTY_EPSILON;

    const receipt = await prisma.$transaction(async (tx) => {
      const created = await tx.delivery.create({
        data: {
          purchaseOrderId: po.id,
          kind: 'RECEIPT',
          status: fullyReceived ? 'DELIVERED' : 'PARTIAL',
          dispatchReference: parsed.data.deliveryNoteReference ?? parsed.data.dispatchReference,
          deliveryNote: parsed.data.deliveryNote,
          attachmentKey: parsed.data.attachmentKey,
          actualDeliveryDate: new Date(),
          receivedBy: req.user!.id,
          comments: parsed.data.notes,
          items: { create: receiptLines },
        },
        include: { items: true },
      });
      const nextStatus = fullyReceived ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
      if (po.status !== nextStatus) {
        assertTransition(PO_TRANSITIONS, po.status, nextStatus, 'purchase order');
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { status: nextStatus } });
      }
      return created;
    });

    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'GOODS_RECEIPT', entityType: 'Delivery', entityId: receipt.id, before: { poId: po.id, status: po.status }, after: { status: receipt.status, totalReceived: round2(totalReceivedAfter) }, metadata: { deliveryNoteReference: parsed.data.deliveryNoteReference, receiver: req.user.id } });
    return res.status(201).json({
      ...receipt,
      summary: po.items.map((item) => {
        const previously = receivedByLine.get(item.id) ?? 0;
        const line = receiptLines.find((candidate) => candidate.purchaseOrderItemId === item.id);
        const now = line ? line.receivedQuantity - line.rejectedQuantity : 0;
        return {
          purchaseOrderItemId: item.id,
          name: item.name,
          ordered: num(item.quantity),
          previouslyReceived: round2(previously),
          receivedNow: round2(now),
          remaining: round2(Math.max(0, num(item.quantity) - previously - now)),
        };
      }),
    });
  } catch (error) { return next(error); }
});



procurementRouter.post('/purchase-orders/:id/invoices', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    if (parsed.data.poId !== String(req.params.id)) {
      return res.status(400).json({ message: 'Purchase order id in the path and body must match' });
    }
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: parsed.data.poId, supplierOrganizationId: req.user.organizationId },
      include: { items: true, deliveries: { include: { items: true } } },
    });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (po.status === 'CANCELLED') return res.status(409).json({ message: 'Cannot invoice a cancelled purchase order' });
    if (['DRAFT', 'ISSUED'].includes(po.status)) {
      return res.status(409).json({ message: 'Purchase order must be acknowledged before invoicing' });
    }
    if (po.currency !== parsed.data.currency) {
      return res.status(400).json({ message: `Invoice currency must match the purchase order currency (${po.currency})` });
    }

    const orderItemMap = new Map(po.items.map((item) => [item.id, item]));
    for (const item of parsed.data.items) {
      if (item.purchaseOrderItemId && !orderItemMap.has(item.purchaseOrderItemId)) {
        return res.status(400).json({ message: `Unknown purchase order item: ${item.purchaseOrderItemId}` });
      }
    }

    const existingInvoice = await prisma.invoice.findUnique({
      where: { supplierOrganizationId_invoiceNumber: { supplierOrganizationId: req.user.organizationId, invoiceNumber: parsed.data.invoiceNumber } },
      select: { id: true },
    });
    if (existingInvoice) return res.status(409).json({ message: 'Invoice number already exists for this supplier' });

    const subtotal = round2(parsed.data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    const tax = round2(parsed.data.tax);
    const total = round2(subtotal + tax);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: parsed.data.invoiceNumber,
        supplierOrganizationId: po.supplierOrganizationId,
        buyerOrganizationId: po.buyerOrganizationId,
        purchaseOrderId: po.id,
        currency: parsed.data.currency,
        subtotal,
        tax,
        total,
        invoiceDate: new Date(parsed.data.invoiceDate),
        dueDate: new Date(parsed.data.dueDate),
        status: 'SUBMITTED',
        attachmentKey: parsed.data.attachmentKey,
        items: {
          create: parsed.data.items.map((item) => ({
            purchaseOrderItemId: item.purchaseOrderItemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: round2(item.quantity * item.unitPrice),
          })),
        },
      },
      include: { items: true },
    });

    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'SUBMIT_INVOICE', entityType: 'Invoice', entityId: invoice.id, before: null, after: { status: invoice.status, total }, metadata: { poId: po.id, attachmentKey: parsed.data.attachmentKey } });

    const match = await runThreeWayMatch(invoice.id, req.user.organizationId);
    return res.status(201).json({ ...invoice, match: match?.result ?? null });
  } catch (error) { return next(error); }
});

procurementRouter.get('/invoices/:id/three-way-match', requireRole('OWNER', 'ADMIN', 'FINANCE', 'APPROVER', 'PROCUREMENT', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const match = await runThreeWayMatch(String(req.params.id), req.user.organizationId);
    if (!match) return res.status(404).json({ message: 'Invoice not found' });
    return res.json(match);
  } catch (error) { return next(error); }
});

procurementRouter.get('/exceptions', requireRole('OWNER', 'ADMIN', 'FINANCE', 'APPROVER', 'PROCUREMENT'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const invoices = await prisma.invoice.findMany({
      where: { buyerOrganizationId: req.user.organizationId, status: { in: ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'DISPUTED'] } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const matches = await Promise.all(invoices.map((invoice) => runThreeWayMatch(invoice.id, req.user!.organizationId!)));
    const items = matches
      .filter((match): match is NonNullable<typeof match> => Boolean(match) && match!.result.exceptions.length > 0)
      .map((match) => ({
        invoiceId: match.invoiceId,
        invoiceNumber: match.invoiceNumber,
        purchaseOrderId: match.purchaseOrderId,
        blocking: match.result.blocking,
        warnings: match.result.warnings,
        exceptions: match.result.exceptions,
      }));
    return res.json({ items, total: items.length });
  } catch (error) { return next(error); }
});

procurementRouter.post('/invoices/:id/decision', requireRole('OWNER', 'ADMIN', 'FINANCE', 'APPROVER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const invoice = await prisma.invoice.findFirst({
      where: { id: String(req.params.id), buyerOrganizationId: req.user.organizationId },
      include: { items: true },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const status = parsed.data.decision === 'APPROVED' ? 'APPROVED' : parsed.data.decision === 'REJECTED' ? 'REJECTED' : 'UNDER_REVIEW';
    assertTransition(INVOICE_TRANSITIONS, invoice.status, status, 'invoice');

    if (status === 'APPROVED') {
      const match = await runThreeWayMatch(invoice.id, req.user.organizationId);
      if (match && match.result.blocking > 0) {
        return res.status(409).json({
          message: 'Invoice cannot be approved while blocking three-way match exceptions remain',
          exceptions: match.result.exceptions.filter((exception) => exception.severity === 'BLOCKING'),
        });
      }
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status, decisionBy: req.user.id, decisionAt: new Date(), decisionReason: parsed.data.reason },
    });
    await recordAudit({ organizationId: invoice.buyerOrganizationId, userId: req.user.id, action: 'INVOICE_DECISION', entityType: 'Invoice', entityId: invoice.id, before: { status: invoice.status }, after: { status: updated.status }, metadata: { decision: parsed.data.decision, reason: parsed.data.reason } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.post('/invoices/:id/payments', requireRole('OWNER', 'ADMIN', 'FINANCE'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const invoice = await prisma.invoice.findFirst({
      where: { id: String(req.params.id), buyerOrganizationId: req.user.organizationId },
      include: { paymentRecords: true },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!['APPROVED', 'PARTIALLY_PAID'].includes(invoice.status)) {
      return res.status(409).json({ message: 'Invoice must be approved before payments can be recorded' });
    }
    if (invoice.currency !== parsed.data.currency) {
      return res.status(400).json({ message: `Payment currency must match the invoice currency (${invoice.currency})` });
    }
    if (invoice.paymentRecords.some((payment) => payment.reference === parsed.data.reference)) {
      return res.status(409).json({ message: 'Payment reference already recorded for this invoice' });
    }

    const currentPaid = round2(invoice.paymentRecords.reduce((sum, payment) => sum + num(payment.amount), 0));
    const payable = num(invoice.total);
    const outstanding = round2(payable - currentPaid);
    if (parsed.data.amount > outstanding + 0.01) {
      return res.status(400).json({ message: 'Payment exceeds the outstanding invoice balance', details: { payable, currentPaid, outstanding } });
    }

    const nextTotal = round2(currentPaid + parsed.data.amount);
    const status = nextTotal >= payable - 0.01 ? 'PAID' : 'PARTIALLY_PAID';
    assertTransition(INVOICE_TRANSITIONS, invoice.status, status, 'invoice');

    const { payment, updated } = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentRecord.create({
        data: {
          invoiceId: invoice.id,
          amount: parsed.data.amount,
          currency: parsed.data.currency,
          paymentMethod: parsed.data.paymentMethod,
          reference: parsed.data.reference,
          notes: parsed.data.notes,
          paidAt: new Date(parsed.data.paymentDate),
          recordedBy: req.user!.id,
        },
      });
      const invoiceUpdate = await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      return { payment: created, updated: invoiceUpdate };
    });

    await recordAudit({ organizationId: invoice.buyerOrganizationId, userId: req.user.id, action: 'RECORD_PAYMENT', entityType: 'PaymentRecord', entityId: payment.id, before: { paid: currentPaid, invoiceStatus: invoice.status }, after: { paid: nextTotal, invoiceStatus: updated.status }, metadata: { reference: parsed.data.reference, method: parsed.data.paymentMethod } });
    return res.status(201).json({ payment, invoice: updated, outstanding: round2(payable - nextTotal) });
  } catch (error) { return next(error); }
});

procurementRouter.post('/purchase-orders/:id/closeout', requireRole('OWNER', 'ADMIN', 'FINANCE', 'APPROVER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const po = await prisma.purchaseOrder.findFirst({
      where: { id: String(req.params.id), buyerOrganizationId: req.user.organizationId },
      include: { items: true, deliveries: { include: { items: true } }, invoices: { include: { paymentRecords: true } } },
    });
    if (!po) return res.status(404).json({ message: 'Purchase order not found' });
    if (['CLOSED', 'COMPLETED'].includes(po.status)) return res.status(409).json({ message: 'Purchase order is already closed' });
    if (po.status === 'CANCELLED') return res.status(409).json({ message: 'Purchase order is cancelled' });

    const blockers: string[] = [];

    const receivedByLine = new Map<string, number>();
    for (const delivery of po.deliveries) {
      if (delivery.kind !== 'RECEIPT') continue;
      for (const item of delivery.items) {
        if (!item.purchaseOrderItemId) continue;
        receivedByLine.set(item.purchaseOrderItemId, (receivedByLine.get(item.purchaseOrderItemId) ?? 0) + num(item.receivedQuantity) - num(item.rejectedQuantity));
      }
    }
    for (const item of po.items) {
      const received = receivedByLine.get(item.id) ?? 0;
      if (received < num(item.quantity) - QTY_EPSILON) {
        blockers.push(`Line "${item.name}" has only ${round2(received)} of ${num(item.quantity)} received`);
      }
    }
    if (po.status !== 'DELIVERED') blockers.push(`Purchase order status is ${po.status}; delivery is not complete`);

    const activeInvoices = po.invoices.filter((invoice) => invoice.status !== 'VOID');
    if (activeInvoices.length === 0) blockers.push('No invoice has been submitted for this purchase order');

    for (const invoice of activeInvoices) {
      if (!['APPROVED', 'PARTIALLY_PAID', 'PAID', 'REJECTED'].includes(invoice.status)) {
        blockers.push(`Invoice ${invoice.invoiceNumber} is still ${invoice.status}`);
        continue;
      }
      if (invoice.status === 'REJECTED') continue;
      const paid = round2(invoice.paymentRecords.reduce((sum, payment) => sum + num(payment.amount), 0));
      if (paid < num(invoice.total) - 0.01) {
        blockers.push(`Invoice ${invoice.invoiceNumber} has an outstanding balance of ${round2(num(invoice.total) - paid)}`);
      }
      const match = await runThreeWayMatch(invoice.id, req.user.organizationId);
      if (match && match.result.blocking > 0) {
        blockers.push(`Invoice ${invoice.invoiceNumber} has ${match.result.blocking} unresolved three-way match exception(s)`);
      }
    }

    if (blockers.length > 0) {
      return res.status(409).json({ message: 'Purchase order cannot be closed', blockers });
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user.id },
    });
    await recordAudit({ organizationId: req.user.organizationId, userId: req.user.id, action: 'CLOSEOUT_PROCUREMENT', entityType: 'PurchaseOrder', entityId: po.id, before: { status: po.status }, after: { status: updated.status }, metadata: { closedBy: req.user.id } });
    return res.json(updated);
  } catch (error) { return next(error); }
});

procurementRouter.get('/invoices', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const items = await prisma.invoice.findMany({
      where: { OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] },
      include: { items: true, paymentRecords: true, purchaseOrder: { select: { id: true, poNumber: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ items });
  } catch (error) { return next(error); }
});

procurementRouter.get('/invoices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const invoice = await prisma.invoice.findFirst({
      where: { id: String(req.params.id), OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] },
      include: { items: true, paymentRecords: true, purchaseOrder: { select: { id: true, poNumber: true, status: true, total: true, currency: true } } },
    });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const paid = round2(invoice.paymentRecords.reduce((sum, payment) => sum + num(payment.amount), 0));
    return res.json({ ...invoice, amountPaid: paid, outstanding: round2(num(invoice.total) - paid) });
  } catch (error) { return next(error); }
});

procurementRouter.get('/supplier/rfqs', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const invitations = await prisma.rFQSupplier.findMany({
      where: { supplierId: orgId },
      include: {
        rfq: {
          include: {
            items: true,
            organization: { select: { id: true, legalName: true, tradingName: true } },
            quotations: { where: { supplierOrganizationId: orgId }, include: { items: true } },
          },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });
    return res.json({
      items: invitations.map((invitation) => ({
        invitationId: invitation.id,
        responseStatus: invitation.responseStatus,
        rfq: invitation.rfq,
        myQuotation: invitation.rfq.quotations[0] ?? null,
      })),
    });
  } catch (error) { return next(error); }
});

procurementRouter.get('/supplier/dashboard', requireRole('OWNER', 'ADMIN', 'SUPPLIER_MANAGER'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const [openRfqs, quotations, purchaseOrders, invoices] = await Promise.all([
      prisma.rFQSupplier.count({ where: { supplierId: orgId, rfq: { status: { in: ['OPEN', 'QUOTES_RECEIVED', 'EVALUATION'] } } } }),
      prisma.quotation.findMany({ where: { supplierOrganizationId: orgId }, select: { id: true, status: true, total: true, currency: true, createdAt: true, rfqId: true } }),
      prisma.purchaseOrder.findMany({ where: { supplierOrganizationId: orgId }, select: { id: true, poNumber: true, status: true, total: true, currency: true, issuedAt: true } }),
      prisma.invoice.findMany({ where: { supplierOrganizationId: orgId }, include: { paymentRecords: true } }),
    ]);
    const awards = quotations.filter((quotation) => ['AWARDED', 'ACCEPTED'].includes(quotation.status));
    const outstanding = round2(invoices.reduce((sum, invoice) => {
      const paid = invoice.paymentRecords.reduce((total, payment) => total + num(payment.amount), 0);
      return sum + Math.max(0, num(invoice.total) - paid);
    }, 0));
    return res.json({
      openRfqs,
      submittedQuotes: quotations.filter((quotation) => quotation.status !== 'DRAFT').length,
      awards: awards.length,
      purchaseOrders: purchaseOrders.length,
      awaitingAcknowledgement: purchaseOrders.filter((po) => ['ISSUED', 'SENT'].includes(po.status)).length,
      deliveriesInProgress: purchaseOrders.filter((po) => ['ACKNOWLEDGED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(po.status)).length,
      invoices: invoices.length,
      invoicesAwaitingDecision: invoices.filter((invoice) => ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW'].includes(invoice.status)).length,
      outstandingReceivable: outstanding,
      recentPurchaseOrders: purchaseOrders.slice(0, 10),
    });
  } catch (error) { return next(error); }
});

procurementRouter.get('/suppliers', async (_req, res, next) => {
  try {
    const items = await prisma.organization.findMany({ where: { type: { in: ['SUPPLIER', 'BOTH'] } }, select: { id: true, legalName: true, tradingName: true, city: true, country: true, verificationStatus: true, categories: { include: { category: true } } } });
    return res.json({ items });
  } catch (error) { return next(error); }
});

procurementRouter.get('/analytics/overview', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const [
      requestsAwaitingApproval,
      openRfqs,
      quotesAwaitingReview,
      awardsAwaitingPo,
      purchaseOrders,
      invoices,
      purchaseRequests,
    ] = await Promise.all([
      prisma.purchaseRequest.count({ where: { organizationId: orgId, status: 'SUBMITTED' } }),
      prisma.rFQ.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'QUOTES_RECEIVED', 'EVALUATION'] } } }),
      prisma.quotation.count({ where: { rfq: { organizationId: orgId }, status: { in: ['SUBMITTED', 'VIEWED', 'REVISED'] } } }),
      prisma.quotation.count({ where: { rfq: { organizationId: orgId }, status: { in: ['AWARDED', 'ACCEPTED'] }, purchaseOrders: { none: {} } } }),
      prisma.purchaseOrder.findMany({
        where: { buyerOrganizationId: orgId },
        select: { id: true, status: true, expectedDeliveryDate: true, total: true, items: { select: { id: true, quantity: true } }, deliveries: { select: { kind: true, items: { select: { purchaseOrderItemId: true, receivedQuantity: true, rejectedQuantity: true } } } } },
      }),
      prisma.invoice.findMany({ where: { buyerOrganizationId: orgId }, include: { paymentRecords: true } }),
      prisma.purchaseRequest.count({ where: { organizationId: orgId } }),
    ]);

    const now = new Date();
    const openPurchaseOrders = purchaseOrders.filter((po) => !['CLOSED', 'COMPLETED', 'CANCELLED'].includes(po.status)).length;
    const deliveriesDue = purchaseOrders.filter((po) =>
      ['ACKNOWLEDGED', 'PROCESSING', 'PARTIALLY_DELIVERED'].includes(po.status) &&
      po.expectedDeliveryDate !== null && po.expectedDeliveryDate <= now).length;

    const goodsAwaitingReceipt = purchaseOrders.filter((po) => {
      if (['CLOSED', 'COMPLETED', 'CANCELLED', 'DRAFT', 'ISSUED'].includes(po.status)) return false;
      const receivedByLine = new Map<string, number>();
      for (const delivery of po.deliveries) {
        if (delivery.kind !== 'RECEIPT') continue;
        for (const item of delivery.items) {
          if (!item.purchaseOrderItemId) continue;
          receivedByLine.set(item.purchaseOrderItemId, (receivedByLine.get(item.purchaseOrderItemId) ?? 0) + num(item.receivedQuantity) - num(item.rejectedQuantity));
        }
      }
      return po.items.some((item) => (receivedByLine.get(item.id) ?? 0) < num(item.quantity) - QTY_EPSILON);
    }).length;

    const invoicesAwaitingMatch = invoices.filter((invoice) => ['SUBMITTED', 'RECEIVED'].includes(invoice.status)).length;
    const invoicesAwaitingApproval = invoices.filter((invoice) => ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED'].includes(invoice.status)).length;
    const paymentsDue = invoices.filter((invoice) => {
      if (!['APPROVED', 'PARTIALLY_PAID'].includes(invoice.status)) return false;
      const paid = invoice.paymentRecords.reduce((sum, payment) => sum + num(payment.amount), 0);
      return paid < num(invoice.total) - 0.01;
    });
    const paymentsDueValue = round2(paymentsDue.reduce((sum, invoice) => {
      const paid = invoice.paymentRecords.reduce((total, payment) => total + num(payment.amount), 0);
      return sum + Math.max(0, num(invoice.total) - paid);
    }, 0));

    const matchCandidates = invoices.filter((invoice) => ['SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'VERIFIED', 'DISPUTED'].includes(invoice.status)).slice(0, 50);
    const matches = await Promise.all(matchCandidates.map((invoice) => runThreeWayMatch(invoice.id, orgId)));
    const exceptions = matches.filter((match) => match && match.result.exceptions.length > 0).length;

    return res.json({
      requestsAwaitingApproval,
      openRfqs,
      quotesAwaitingReview,
      awardsAwaitingPo,
      openPurchaseOrders,
      deliveriesDue,
      goodsAwaitingReceipt,
      invoicesAwaitingMatch,
      invoicesAwaitingApproval,
      paymentsDue: paymentsDue.length,
      paymentsDueValue,
      exceptions,
      invoicesDue: paymentsDue.length,
      purchaseRequests,
    });
  } catch (error) { return next(error); }
});
