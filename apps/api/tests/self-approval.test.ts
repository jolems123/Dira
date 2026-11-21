import { describe, expect, it } from 'vitest';
import { api, BASE, registerOrg, auth } from './helpers';

describe('segregation of duties', () => {
  it('blocks self-approval even when requester is an OWNER', async () => {
    const actor = await registerOrg('BUYER', 'OwnApproval');
    const created = await api().post(`${BASE}/purchase-requests`).set(auth(actor)).send({
      title: 'Office equipment', department: 'Operations', currency: 'USD',
      items: [{ name: 'Desk', quantity: 1, estimatedUnitPrice: 200 }],
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await api().post(`${BASE}/purchase-requests/${id}/submit`).set(auth(actor))).status).toBe(200);
    const approval = await api().post(`${BASE}/purchase-requests/${id}/approve`).set(auth(actor)).send({});
    expect(approval.status).toBe(403);
  });

  it('blocks a requester from rejecting their own submitted request', async () => {
    const actor = await registerOrg('BUYER', 'OwnRejection');
    const created = await api().post(`${BASE}/purchase-requests`).set(auth(actor)).send({
      title: 'Equipment replacement', department: 'Operations',
      items: [{ name: 'Printer', quantity: 1, estimatedUnitPrice: 300 }],
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await api().post(`${BASE}/purchase-requests/${id}/submit`).set(auth(actor))).status).toBe(200);
    const rejected = await api().post(`${BASE}/purchase-requests/${id}/reject`).set(auth(actor)).send({});
    expect(rejected.status).toBe(403);
  });

  it('permits approval by a different authorised member of the same organisation', async () => {
    const requester = await registerOrg('BUYER', 'Separation');
    const approver = await registerOrg('BUYER', 'OtherApprover');
    // Add a second user to the buyer organisation, not merely give a role in a different tenant.
    const { prisma } = await import('../src/db');
    await prisma.organizationMember.deleteMany({ where: { userId: approver.userId } });
    await prisma.organizationMember.create({
      data: { organizationId: requester.organizationId, userId: approver.userId, role: 'APPROVER' },
    });
    const created = await api().post(`${BASE}/purchase-requests`).set(auth(requester)).send({
      title: 'Clinic supplies', department: 'Operations',
      items: [{ name: 'Gloves', quantity: 2, estimatedUnitPrice: 20 }],
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await api().post(`${BASE}/purchase-requests/${id}/submit`).set(auth(requester))).status).toBe(200);
    const approval = await api().post(`${BASE}/purchase-requests/${id}/approve`).set(auth(approver)).send({});
    expect(approval.status).toBe(200);
  });
});
