import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth';

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
  notes: z.string().max(500).optional(),
});

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
        status: { in: ['SUBMITTED', 'VIEWED', 'ACCEPTED'] },
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

    const existingPurchaseOrder = await prisma.purchaseOrder.findFirst({
      where: { rfqId: rfq.id, supplierOrganizationId: quotation.supplierOrganizationId },
      select: { id: true },
    });
    if (existingPurchaseOrder) return res.status(409).json({ message: 'A purchase order has already been created for this supplier and RFQ' });

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
          status: 'SENT',
          issuedAt: new Date(),
          items: {
            create: quotation.items.map((item, index) => ({
              name: `Line ${index + 1}`,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      await tx.rFQ.update({ where: { id: rfq.id }, data: { status: 'AWARDED' } });
      await tx.quotation.update({ where: { id: quotation.id }, data: { status: 'ACCEPTED' } });
      return created;
    });

    return res.status(201).json({ purchaseOrder, notes: parsed.data.notes });
  } catch (error) { return next(error); }
});

procurementRouter.get('/purchase-orders', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const items = await prisma.purchaseOrder.findMany({
      where: { buyerOrganizationId: req.user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return res.json({ items });
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
    const [openRfqs, invoicesDue, requests] = await Promise.all([
      prisma.rFQ.count({ where: { organizationId: req.user!.organizationId, status: { in: ['OPEN', 'QUOTES_RECEIVED', 'EVALUATION'] } } }),
      prisma.invoice.count({ where: { buyerOrganizationId: req.user!.organizationId, status: { in: ['DUE', 'OVERDUE', 'PARTIALLY_PAID'] } } }),
      prisma.purchaseRequest.count({ where: { organizationId: req.user!.organizationId } }),
    ]);
    return res.json({ openRfqs, invoicesDue, purchaseRequests: requests });
  } catch (error) { return next(error); }
});
