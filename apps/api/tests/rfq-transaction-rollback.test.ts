import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db';
import { api, BASE, auth, isoDays, registerApprover, registerOrg } from './helpers';

/**
 * Real PostgreSQL regression: a failed second RFQ claim must roll back its
 * nested RFQ/items/invitations rather than leaving a duplicate behind.
 * Run only against a disposable migrated test database.
 */
describe('RFQ creation transaction rollback', () => {
  it('persists exactly one RFQ when the same approved request is submitted twice', async () => {
    const buyer = await registerOrg('BUYER', 'RfqRollbackBuyer');
    const approver = await registerApprover(buyer);
    const supplier = await registerOrg('SUPPLIER', 'RfqRollbackSupplier');

    const created = await api().post(`${BASE}/purchase-requests`).set(auth(buyer)).send({
      title: 'Rollback verification request',
      department: 'Operations',
      currency: 'USD',
      items: [{ name: 'Paper', quantity: 2, estimatedUnitPrice: 10 }],
    });
    expect(created.status).toBe(201);
    const requestId = created.body.id;
    expect((await api().post(`${BASE}/purchase-requests/${requestId}/submit`).set(auth(buyer))).status).toBe(200);
    expect((await api().post(`${BASE}/purchase-requests/${requestId}/approve`).set(auth(approver)).send({})).status).toBe(200);

    const payload = {
      purchaseRequestId: requestId,
      quoteDeadline: isoDays(14),
      currency: 'USD',
      supplierIds: [supplier.organizationId],
    };
    const first = await api().post(`${BASE}/rfqs`).set(auth(buyer)).send(payload);
    expect(first.status).toBe(201);
    const second = await api().post(`${BASE}/rfqs`).set(auth(buyer)).send(payload);
    expect(second.status).toBe(409);

    const rfqs = await prisma.rFQ.findMany({
      where: { purchaseRequestId: requestId, organizationId: buyer.organizationId },
      include: { items: true, suppliers: true },
    });
    expect(rfqs).toHaveLength(1);
    expect(rfqs[0].id).toBe(first.body.id);
    expect(rfqs[0].items).toHaveLength(1);
    expect(rfqs[0].suppliers).toHaveLength(1);
    expect((await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('RFQ_CREATED');
  });
});
