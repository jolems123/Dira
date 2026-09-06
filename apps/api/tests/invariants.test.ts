import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/db';

interface Invariant {
  name: string;
  sql: string;
}

/**
 * Blocking data-integrity invariants. Any non-zero count is a defect in the
 * business logic, not in the data, and must fail CI.
 */
const INVARIANTS: Invariant[] = [
  {
    name: 'no orphan quotation',
    sql: 'SELECT count(*)::int AS n FROM "Quotation" q LEFT JOIN "RFQ" r ON r.id = q."rfqId" WHERE r.id IS NULL',
  },
  {
    name: 'no orphan purchase order',
    sql: 'SELECT count(*)::int AS n FROM "PurchaseOrder" p LEFT JOIN "Organization" b ON b.id = p."buyerOrganizationId" LEFT JOIN "Organization" s ON s.id = p."supplierOrganizationId" WHERE b.id IS NULL OR s.id IS NULL',
  },
  {
    name: 'no orphan delivery',
    sql: 'SELECT count(*)::int AS n FROM "Delivery" d LEFT JOIN "PurchaseOrder" p ON p.id = d."purchaseOrderId" WHERE p.id IS NULL',
  },
  {
    name: 'no orphan delivery item',
    sql: 'SELECT count(*)::int AS n FROM "DeliveryItem" di LEFT JOIN "Delivery" d ON d.id = di."deliveryId" WHERE d.id IS NULL',
  },
  {
    name: 'no orphan invoice',
    sql: 'SELECT count(*)::int AS n FROM "Invoice" i LEFT JOIN "Organization" s ON s.id = i."supplierOrganizationId" LEFT JOIN "Organization" b ON b.id = i."buyerOrganizationId" WHERE s.id IS NULL OR b.id IS NULL',
  },
  {
    name: 'no orphan payment record',
    sql: 'SELECT count(*)::int AS n FROM "PaymentRecord" pr LEFT JOIN "Invoice" i ON i.id = pr."invoiceId" WHERE i.id IS NULL',
  },
  {
    name: 'no over-received purchase order line',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT poi.id, poi.quantity, COALESCE(SUM(di."receivedQuantity" - di."rejectedQuantity"), 0) AS received
      FROM "PurchaseOrderItem" poi
      LEFT JOIN "DeliveryItem" di ON di."purchaseOrderItemId" = poi.id
      LEFT JOIN "Delivery" d ON d.id = di."deliveryId" AND d.kind = 'RECEIPT'
      WHERE d.id IS NOT NULL
      GROUP BY poi.id, poi.quantity
      HAVING COALESCE(SUM(di."receivedQuantity" - di."rejectedQuantity"), 0) > poi.quantity + 0.005
    ) violations`,
  },
  {
    name: 'no payment total above invoice total',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT i.id FROM "Invoice" i
      JOIN "PaymentRecord" pr ON pr."invoiceId" = i.id
      GROUP BY i.id, i.total
      HAVING SUM(pr.amount) > i.total + 0.01
    ) violations`,
  },
  {
    name: 'no invoice marked PAID without full payment',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT i.id FROM "Invoice" i
      LEFT JOIN "PaymentRecord" pr ON pr."invoiceId" = i.id
      WHERE i.status = 'PAID'
      GROUP BY i.id, i.total
      HAVING COALESCE(SUM(pr.amount), 0) < i.total - 0.01
    ) violations`,
  },
  {
    name: 'no closed purchase order with an unpaid non-void invoice',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT p.id FROM "PurchaseOrder" p
      JOIN "Invoice" i ON i."purchaseOrderId" = p.id AND i.status NOT IN ('VOID', 'REJECTED')
      LEFT JOIN "PaymentRecord" pr ON pr."invoiceId" = i.id
      WHERE p.status IN ('CLOSED', 'COMPLETED')
      GROUP BY p.id, i.id, i.total
      HAVING COALESCE(SUM(pr.amount), 0) < i.total - 0.01
    ) violations`,
  },
  {
    name: 'no closed purchase order with incomplete delivery',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT p.id FROM "PurchaseOrder" p
      JOIN "PurchaseOrderItem" poi ON poi."purchaseOrderId" = p.id
      LEFT JOIN "DeliveryItem" di ON di."purchaseOrderItemId" = poi.id
      LEFT JOIN "Delivery" d ON d.id = di."deliveryId" AND d.kind = 'RECEIPT'
      WHERE p.status IN ('CLOSED', 'COMPLETED')
      GROUP BY p.id, poi.id, poi.quantity
      HAVING COALESCE(SUM(CASE WHEN d.kind = 'RECEIPT' THEN di."receivedQuantity" - di."rejectedQuantity" ELSE 0 END), 0) < poi.quantity - 0.005
    ) violations`,
  },
  {
    name: 'no duplicate active award per RFQ',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT "rfqId" FROM "Quotation" WHERE status IN ('AWARDED', 'ACCEPTED')
      GROUP BY "rfqId" HAVING count(*) > 1
    ) violations`,
  },
  {
    name: 'no duplicate purchase order per RFQ',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT "rfqId" FROM "PurchaseOrder" WHERE "rfqId" IS NOT NULL AND status <> 'CANCELLED'
      GROUP BY "rfqId" HAVING count(*) > 1
    ) violations`,
  },
  {
    name: 'no cross-organization purchase order ownership mismatch',
    sql: `SELECT count(*)::int AS n FROM "PurchaseOrder" p
      JOIN "RFQ" r ON r.id = p."rfqId"
      WHERE r."organizationId" <> p."buyerOrganizationId"`,
  },
  {
    name: 'no cross-organization invoice ownership mismatch',
    sql: `SELECT count(*)::int AS n FROM "Invoice" i
      JOIN "PurchaseOrder" p ON p.id = i."purchaseOrderId"
      WHERE p."buyerOrganizationId" <> i."buyerOrganizationId"
         OR p."supplierOrganizationId" <> i."supplierOrganizationId"`,
  },
  {
    name: 'no quotation from a supplier that was not invited',
    sql: `SELECT count(*)::int AS n FROM "Quotation" q
      LEFT JOIN "RFQSupplier" rs ON rs."rfqId" = q."rfqId" AND rs."supplierId" = q."supplierOrganizationId"
      WHERE rs.id IS NULL`,
  },
  {
    name: 'no duplicate invoice number per supplier',
    sql: `SELECT count(*)::int AS n FROM (
      SELECT "supplierOrganizationId", "invoiceNumber" FROM "Invoice"
      GROUP BY 1, 2 HAVING count(*) > 1
    ) violations`,
  },
];

describe('database invariants', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  for (const invariant of INVARIANTS) {
    it(invariant.name, async () => {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(invariant.sql);
      expect(Number(rows[0]?.n ?? 0), `${invariant.name} violated`).toBe(0);
    });
  }
});
