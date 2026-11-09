import { describe, expect, it, vi } from 'vitest';
import { claimPurchaseRequestDecision } from '../src/lib/approval-claim';

describe('atomic purchase request decision', () => {
  it('claims a submitted request once, scoped to its organisation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const claimed = await claimPurchaseRequestDecision({ purchaseRequest: { updateMany } }, {
      id: 'pr-1', organizationId: 'org-1', status: 'APPROVED',
    });
    expect(claimed).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'pr-1', organizationId: 'org-1', status: 'SUBMITTED' },
      data: { status: 'APPROVED' },
    });
  });
  it('rejects a concurrent approval or rejection after the first claim', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    expect(await claimPurchaseRequestDecision({ purchaseRequest: { updateMany } }, {
      id: 'pr-1', organizationId: 'org-1', status: 'REJECTED',
    })).toBe(false);
  });
});
