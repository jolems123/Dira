import { describe, expect, it, vi } from 'vitest';
import { claimPurchaseRequestSubmission } from '../src/lib/request-submit-claim';

describe('purchase request submission claim', () => {
  it('claims only a draft belonging to the current organisation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    expect(await claimPurchaseRequestSubmission({ purchaseRequest: { updateMany } } as any, { id: 'pr1', organizationId: 'buyer1' })).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'pr1', organizationId: 'buyer1', status: 'DRAFT' },
      data: { status: 'SUBMITTED', submittedAt: expect.any(Date) },
    });
  });
  it('rejects stale, already-submitted, or cross-tenant claims', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    expect(await claimPurchaseRequestSubmission({ purchaseRequest: { updateMany } } as any, { id: 'pr1', organizationId: 'buyer2' })).toBe(false);
  });
});
