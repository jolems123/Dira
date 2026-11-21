import { describe, expect, it, vi } from 'vitest';
import { claimRequestForRfq } from '../src/lib/rfq-request-claim';

describe('atomic RFQ creation request claim', () => {
  it('updates only an approved request in the same buyer organisation', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    expect(await claimRequestForRfq({ purchaseRequest: { updateMany } }, 'request-1', 'buyer-1')).toBe(true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'request-1', organizationId: 'buyer-1', status: 'APPROVED' },
      data: { status: 'RFQ_CREATED' },
    });
  });
  it('refuses concurrent claims and cross-tenant requests', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    expect(await claimRequestForRfq({ purchaseRequest: { updateMany } }, 'request-1', 'other-buyer')).toBe(false);
  });
  it('fails closed if a malformed database adapter reports multiple claimed rows', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    expect(await claimRequestForRfq({ purchaseRequest: { updateMany } }, 'request-1', 'buyer-1')).toBe(false);
  });
  it('propagates database failures instead of claiming success', async () => {
    const updateMany = vi.fn().mockRejectedValue(new Error('database unavailable'));
    await expect(claimRequestForRfq({ purchaseRequest: { updateMany } }, 'request-1', 'buyer-1')).rejects.toThrow('database unavailable');
  });
});
