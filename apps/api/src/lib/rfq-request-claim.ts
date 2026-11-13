/**
 * Claim an approved purchase request for RFQ creation inside the same
 * transaction that creates the RFQ. A zero-count claim must roll back the
 * transaction to avoid orphaned or duplicate RFQs.
 */
export async function claimRequestForRfq(
  tx: { purchaseRequest: { updateMany(args: {
    where: { id: string; organizationId: string; status: 'APPROVED' };
    data: { status: 'RFQ_CREATED' };
  }): Promise<{ count: number }> } },
  requestId: string,
  organizationId: string,
): Promise<boolean> {
  const result = await tx.purchaseRequest.updateMany({
    where: { id: requestId, organizationId, status: 'APPROVED' },
    data: { status: 'RFQ_CREATED' },
  });
  return result.count === 1;
}

export class RfqRequestAlreadyClaimedError extends Error {
  constructor() { super('Purchase request is no longer available for RFQ creation'); }
}
