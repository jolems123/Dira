import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthenticatedRequest, requireAuth, requireRole } from '../middleware/auth';
import { requestFromTemplate, toDraftItems } from '../lib/repeat-procurement';

const MANAGE_ROLES = ['OWNER', 'ADMIN', 'REQUESTER', 'PROCUREMENT'];

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  estimatedUnitPrice: z.number().nonnegative().optional(),
  specifications: z.string().optional(),
});

const scheduleFields = {
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY']).nullable().optional(),
  scheduleActive: z.boolean().optional(),
  nextRunAt: z.string().datetime().nullable().optional(),
};

const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  sourceRequestId: z.string().min(1).optional(),
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  department: z.string().min(2).optional(),
  currency: z.string().length(3).default('UGX'),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  preferredSupplierIds: z.array(z.string().min(1)).optional(),
  items: z.array(itemSchema).min(1).optional(),
  ...scheduleFields,
}).refine((value) => value.sourceRequestId || (value.title && value.items), {
  message: 'Provide a sourceRequestId, or a title and items',
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  department: z.string().min(2).nullable().optional(),
  currency: z.string().length(3).optional(),
  leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
  preferredSupplierIds: z.array(z.string().min(1)).optional(),
  items: z.array(itemSchema).min(1).optional(),
  ...scheduleFields,
});

const templateInclude = {
  items: true,
  _count: { select: { purchaseRequests: true } },
} satisfies Prisma.ProcurementTemplateInclude;

async function invalidSupplierIds(ids: string[] | undefined) {
  if (!ids || ids.length === 0) return false;
  const unique = [...new Set(ids)];
  const found = await prisma.organization.count({ where: { id: { in: unique }, type: { in: ['SUPPLIER', 'BOTH'] } } });
  return found !== unique.length;
}

/** An active schedule needs a frequency; the first run defaults to now so it drafts on the next scheduler tick. */
function resolveSchedule(
  input: { frequency?: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | null; scheduleActive?: boolean; nextRunAt?: string | null },
  current?: { frequency: string | null; scheduleActive: boolean; nextRunAt: Date | null },
) {
  const frequency = input.frequency !== undefined ? input.frequency : (current?.frequency as typeof input.frequency) ?? null;
  const scheduleActive = input.scheduleActive ?? current?.scheduleActive ?? false;
  let nextRunAt = input.nextRunAt !== undefined ? (input.nextRunAt ? new Date(input.nextRunAt) : null) : current?.nextRunAt ?? null;
  if (scheduleActive && !frequency) return { error: 'Choose how often the request should repeat before activating the schedule' } as const;
  if (scheduleActive && !nextRunAt) nextRunAt = new Date();
  return { frequency, scheduleActive, nextRunAt } as const;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

templatesRouter.get('/templates', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const items = await prisma.procurementTemplate.findMany({
      where: { organizationId: req.user.organizationId },
      include: templateInclude,
      orderBy: { name: 'asc' },
    });
    return res.json({ items });
  } catch (error) { return next(error); }
});

templatesRouter.get('/templates/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const template = await prisma.procurementTemplate.findFirst({
      where: { id: String(req.params.id), organizationId: req.user.organizationId },
      include: { ...templateInclude, purchaseRequests: { select: { id: true, requestNumber: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    return res.json(template);
  } catch (error) { return next(error); }
});

templatesRouter.post('/templates', requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const orgId = req.user.organizationId;
    const data = parsed.data;

    let base = { title: data.title, description: data.description, department: data.department, currency: data.currency, items: data.items, preferredSupplierIds: data.preferredSupplierIds, leadTimeDays: data.leadTimeDays };
    if (data.sourceRequestId) {
      const source = await prisma.purchaseRequest.findFirst({
        where: { id: data.sourceRequestId, organizationId: orgId },
        include: { items: true, rfqs: { select: { suppliers: { select: { supplierId: true } } } } },
      });
      if (!source) return res.status(404).json({ message: 'Purchase request not found' });
      base = {
        title: data.title ?? source.title,
        description: data.description ?? source.description ?? undefined,
        department: data.department ?? source.department ?? undefined,
        currency: source.currency,
        items: data.items ?? toDraftItems(source.items).map((item) => ({
          name: item.name,
          description: item.description ?? undefined,
          quantity: item.quantity,
          unit: item.unit ?? undefined,
          categoryId: item.categoryId ?? undefined,
          estimatedUnitPrice: item.estimatedUnitPrice ?? undefined,
          specifications: item.specifications ?? undefined,
        })),
        preferredSupplierIds: data.preferredSupplierIds ?? [...new Set(source.rfqs.flatMap((rfq) => rfq.suppliers.map((supplier) => supplier.supplierId)))],
        leadTimeDays: data.leadTimeDays ?? (source.requiredBy ? Math.max(0, Math.round((source.requiredBy.getTime() - source.createdAt.getTime()) / 86_400_000)) : undefined),
      };
    }
    if (await invalidSupplierIds(base.preferredSupplierIds)) return res.status(400).json({ message: 'One or more preferred suppliers are invalid' });

    const schedule = resolveSchedule(data);
    if ('error' in schedule) return res.status(400).json({ message: schedule.error });

    const template = await prisma.procurementTemplate.create({
      data: {
        organizationId: orgId,
        name: data.name,
        title: base.title!,
        description: base.description,
        department: base.department,
        currency: base.currency,
        leadTimeDays: base.leadTimeDays,
        preferredSupplierIds: base.preferredSupplierIds ?? [],
        createdBy: req.user.id,
        ...schedule,
        items: { create: base.items! },
      },
      include: templateInclude,
    });
    return res.status(201).json(template);
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ message: 'A template with this name already exists' });
    return next(error);
  }
});

templatesRouter.patch('/templates/:id', requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res, next) => {
  try {
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Validation failed', errors: parsed.error.flatten() });
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const current = await prisma.procurementTemplate.findFirst({ where: { id: String(req.params.id), organizationId: req.user.organizationId } });
    if (!current) return res.status(404).json({ message: 'Template not found' });
    if (await invalidSupplierIds(parsed.data.preferredSupplierIds)) return res.status(400).json({ message: 'One or more preferred suppliers are invalid' });

    const schedule = resolveSchedule(parsed.data, current);
    if ('error' in schedule) return res.status(400).json({ message: schedule.error });
    const { items, frequency: _frequency, scheduleActive: _active, nextRunAt: _next, ...fields } = parsed.data;

    const template = await prisma.$transaction(async (tx) => {
      if (items) await tx.procurementTemplateItem.deleteMany({ where: { templateId: current.id } });
      return tx.procurementTemplate.update({
        where: { id: current.id },
        data: { ...fields, ...schedule, ...(items ? { items: { create: items } } : {}) },
        include: templateInclude,
      });
    });
    return res.json(template);
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ message: 'A template with this name already exists' });
    return next(error);
  }
});

templatesRouter.delete('/templates/:id', requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const deleted = await prisma.procurementTemplate.deleteMany({ where: { id: String(req.params.id), organizationId: req.user.organizationId } });
    if (deleted.count === 0) return res.status(404).json({ message: 'Template not found' });
    return res.status(204).send();
  } catch (error) { return next(error); }
});

templatesRouter.post('/templates/:id/requests', requireRole(...MANAGE_ROLES), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.user?.organizationId) return res.status(403).json({ message: 'Organization membership required' });
    const request = await prisma.$transaction((tx) => requestFromTemplate(tx, String(req.params.id), req.user!.organizationId!, req.user!.id));
    if (!request) return res.status(404).json({ message: 'Template not found' });
    return res.status(201).json(request);
  } catch (error) { return next(error); }
});
