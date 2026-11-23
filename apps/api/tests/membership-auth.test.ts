import { describe, expect, it } from 'vitest';
import { api, BASE, registerOrg, auth } from './helpers';
import { prisma } from '../src/db';

describe('membership activation', () => {
  it('denies access when a membership is suspended', async () => {
    const actor = await registerOrg('BUYER', 'SuspendedMember');
    await prisma.organizationMember.updateMany({
      where: { userId: actor.userId, organizationId: actor.organizationId },
      data: { status: 'SUSPENDED' },
    });
    const response = await api().get(`${BASE}/purchase-requests`).set(auth(actor));
    expect(response.status).toBe(403);
  });
  it('denies buyer document access without active organisation membership', async () => {
    const actor = await registerOrg('BUYER', 'NoMember');
    await prisma.organizationMember.deleteMany({ where: { userId: actor.userId } });
    const response = await api().get(`${BASE}/purchase-requests`).set(auth(actor));
    expect(response.status).toBe(403);
  });
});
