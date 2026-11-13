import { describe, expect, it, vi } from 'vitest';
import { claimPurchaseRequestDecision } from '../src/lib/approval-claim';

describe('atomic purchase request decision', () => {
  it('claims a submitted request once, scoped to its organisation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const claimed = await claimPurchaseRequestDecision({ purchaseRequest: { updateMany } }, {
      id: 'pr-1', organizationId: 'org-1', status: 'APPROVED', actorId: 'approver-1',
    });
    expect(claimed).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'pr-1', organizationId: 'org-1', status: 'SUBMITTED', requestedBy: { not: 'approver-1' } },
      data: { status: 'APPROVED' },
    });
  });
  it('rejects a concurrent approval or rejection after the first claim', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    expect(await claimPurchaseRequestDecision({ purchaseRequest: { updateMany } }, {
      id: 'pr-1', organizationId: 'org-1', status: 'REJECTED', actorId: 'approver-1',
    })).toBe(false);
  });
  it('fails closed if the requester is the approver even when the route precheck is bypassed', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    expect(await claimPurchaseRequestDecision({ purchaseRequest: { updateMany } }, {
      id: 'pr-2', organizationId: 'org-1', status: 'APPROVED', actorId: 'requester-1',
    })).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'pr-2', organizationId: 'org-1', status: 'SUBMITTED', requestedBy: { not: 'requester-1' } },
      data: { status: 'APPROVED' },
    });
  });
});
