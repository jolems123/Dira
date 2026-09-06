import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth';
import { validateUpload } from '../lib/uploads';
import { checksum, storage } from '../lib/storage';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const metadataSchema = z.object({
  entityType: z.enum(['QUOTATION', 'PURCHASE_ORDER', 'DELIVERY', 'INVOICE', 'PAYMENT']),
  entityId: z.string().min(1),
  documentType: z.enum(['QUOTE', 'DELIVERY_NOTE', 'RECEIPT_EVIDENCE', 'INVOICE', 'PAYMENT_EVIDENCE']),
});

type OwnedEntity = { organizationId: string; entity: object };

async function resolveEntity(req: AuthenticatedRequest, entityType: string, entityId: string): Promise<OwnedEntity | null> {
  const orgId = req.user?.organizationId;
  if (!orgId) return null;
  if (entityType === 'QUOTATION') {
    const quote = await prisma.quotation.findUnique({ where: { id: entityId } });
    if (!quote) return null;
    const rfq = await prisma.rFQ.findUnique({ where: { id: quote.rfqId }, select: { organizationId: true } });
    if (quote.supplierOrganizationId !== orgId && rfq?.organizationId !== orgId) return null;
    return { organizationId: quote.supplierOrganizationId === orgId ? orgId : rfq!.organizationId, entity: quote };
  }
  if (entityType === 'PURCHASE_ORDER') {
    const po = await prisma.purchaseOrder.findFirst({ where: { id: entityId, OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] } });
    return po ? { organizationId: po.buyerOrganizationId === orgId ? po.buyerOrganizationId : po.supplierOrganizationId, entity: po } : null;
  }
  if (entityType === 'DELIVERY') {
    const delivery = await prisma.delivery.findFirst({ where: { id: entityId, purchaseOrder: { OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] } }, include: { purchaseOrder: true } });
    return delivery ? { organizationId: delivery.purchaseOrder.buyerOrganizationId, entity: delivery } : null;
  }
  if (entityType === 'INVOICE') {
    const invoice = await prisma.invoice.findFirst({ where: { id: entityId, OR: [{ buyerOrganizationId: orgId }, { supplierOrganizationId: orgId }] } });
    return invoice ? { organizationId: invoice.supplierOrganizationId === orgId ? invoice.supplierOrganizationId : invoice.buyerOrganizationId, entity: invoice } : null;
  }
  const payment = await prisma.paymentRecord.findFirst({ where: { id: entityId, invoice: { buyerOrganizationId: orgId } }, include: { invoice: true } });
  return payment ? { organizationId: payment.invoice.buyerOrganizationId, entity: payment } : null;
}

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.post('/', (req: AuthenticatedRequest, res, next) => {
  upload.single('file')(req, res, async (error) => {
    try {
      if (error) return res.status(400).json({ message: error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 10 MB limit' : 'Invalid upload' });
      if (!req.file) return res.status(400).json({ message: 'A file is required' });
      const metadata = metadataSchema.safeParse(req.body);
      if (!metadata.success) return res.status(400).json({ message: 'Invalid document metadata', errors: metadata.error.flatten() });
      const owned = await resolveEntity(req, metadata.data.entityType, metadata.data.entityId);
      if (!owned) return res.status(404).json({ message: 'Entity not found' });
      if (metadata.data.entityType === 'PAYMENT' && !['OWNER', 'ADMIN', 'FINANCE'].includes(req.user?.role ?? '')) return res.status(403).json({ message: 'Insufficient permissions' });
      if (metadata.data.entityType === 'DELIVERY' && metadata.data.documentType === 'RECEIPT_EVIDENCE' && !['OWNER', 'ADMIN', 'RECEIVER', 'PROCUREMENT'].includes(req.user?.role ?? '')) return res.status(403).json({ message: 'Insufficient permissions' });
      const validation = validateUpload({ filename: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, content: req.file.buffer });
      if (!validation.ok || !validation.storageName) return res.status(400).json({ message: 'File validation failed', errors: validation.errors });
      const digest = checksum(req.file.buffer);
      const duplicate = await prisma.document.findFirst({ where: { organizationId: owned.organizationId, entityType: metadata.data.entityType, entityId: metadata.data.entityId, checksum: digest } });
      if (duplicate) return res.status(409).json({ message: 'This document has already been uploaded', documentId: duplicate.id });
      await storage.put(validation.storageName, req.file.buffer, req.file.mimetype);
      const document = await prisma.document.create({ data: { organizationId: owned.organizationId, uploadedByUserId: req.user!.id, entityType: metadata.data.entityType, entityId: metadata.data.entityId, documentType: metadata.data.documentType, originalFilename: req.file.originalname, storageKey: validation.storageName, mimeType: req.file.mimetype, sizeBytes: req.file.size, checksum: digest } });
      await prisma.auditLog.create({ data: { organizationId: owned.organizationId, userId: req.user!.id, action: 'DOCUMENT_UPLOADED', entityType: 'Document', entityId: document.id, metadata: { targetEntityType: document.entityType, targetEntityId: document.entityId, documentType: document.documentType } } });
      return res.status(201).json({ document: { id: document.id, originalFilename: document.originalFilename, documentType: document.documentType, mimeType: document.mimeType, sizeBytes: document.sizeBytes, checksum: document.checksum, createdAt: document.createdAt }, downloadUrl: `/api/v1/documents/${document.id}/content` });
    } catch (caught) { return next(caught); }
  });
});

documentsRouter.get('/:id/content', async (req: AuthenticatedRequest, res, next) => {
  try {
    const document = await prisma.document.findFirst({ where: { id: String(req.params.id) } });
    if (!document) return res.status(404).json({ message: 'Document not found' });
    const authorized = await resolveEntity(req, document.entityType, document.entityId);
    if (!authorized) return res.status(404).json({ message: 'Document not found' });
    const content = await storage.get(document.storageKey);
    if (checksum(content) !== document.checksum) return res.status(409).json({ message: 'Document integrity check failed' });
    await prisma.auditLog.create({ data: { organizationId: authorized.organizationId, userId: req.user!.id, action: 'DOCUMENT_VIEWED', entityType: 'Document', entityId: document.id } });
    res.type(document.mimeType).set('Content-Disposition', `inline; filename="${document.originalFilename.replace(/["\r\n]/g, '')}"`);
    return res.send(content);
  } catch (caught) { return next(caught); }
});

documentsRouter.get('/:entityType/:entityId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const authorized = await resolveEntity(req, String(req.params.entityType), String(req.params.entityId));
    if (!authorized) return res.status(404).json({ message: 'Entity not found' });
    const items = await prisma.document.findMany({ where: { entityType: String(req.params.entityType), entityId: String(req.params.entityId) }, orderBy: { createdAt: 'desc' }, select: { id: true, originalFilename: true, documentType: true, mimeType: true, sizeBytes: true, checksum: true, createdAt: true } });
    return res.json({ items: items.map((item) => ({ ...item, downloadUrl: `/api/v1/documents/${item.id}/content` })) });
  } catch (caught) { return next(caught); }
});
