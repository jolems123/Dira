/**
 * Compare-and-swap approval state. Call inside the same transaction that
 * records the approval decision, so concurrent approve/reject requests cannot
 * both record a final decision.
 */
export async function claimPurchaseRequestDecision(
  tx: { purchaseRequest: { updateMany(args: {
    where: { id: string; organizationId: string; status: 'SUBMITTED'; requestedBy: { not: string } };
    data: { status: 'APPROVED' | 'REJECTED' };
  }): Promise<{ count: number }> } },
  input: { id: string; organizationId: string; status: 'APPROVED' | 'REJECTED'; actorId: string },
): Promise<boolean> {
  const result = await tx.purchaseRequest.updateMany({
    where: { id: input.id, organizationId: input.organizationId, status: 'SUBMITTED', requestedBy: { not: input.actorId } },
    data: { status: input.status },
  });
  return result.count === 1;
}
