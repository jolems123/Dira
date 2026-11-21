import { describe, expect, it } from 'vitest';
import { api, BASE, registerOrg, auth } from './helpers';

/** Cross-tenant approval must fail even if the outsider is an organisation owner. */
describe('purchase request approval tenant boundary', () => {
  it('rejects approval and rejection attempts from another buyer organisation', async () => {
    const buyer = await registerOrg('BUYER', 'TenantBuyer');
    const outsider = await registerOrg('BUYER', 'TenantOutsider');
    const created = await api().post(`${BASE}/purchase-requests`).set(auth(buyer)).send({
      title: 'Tenant boundary supplies', department: 'Operations', currency: 'USD',
      items: [{ name: 'Paper', quantity: 2, estimatedUnitPrice: 10 }],
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await api().post(`${BASE}/purchase-requests/${id}/submit`).set(auth(buyer))).status).toBe(200);
    for (const action of ['approve', 'reject'] as const) {
      const response = await api().post(`${BASE}/purchase-requests/${id}/${action}`).set(auth(outsider)).send({});
      expect([403, 404]).toContain(response.status);
    }
    // A rejected outsider request must not mutate the legitimate tenant's record.
    const ownerView = await api().get(`${BASE}/purchase-requests/${id}`).set(auth(buyer));
    expect(ownerView.status).toBe(200);
    expect(ownerView.body.status).toBe('SUBMITTED');
  });
});
