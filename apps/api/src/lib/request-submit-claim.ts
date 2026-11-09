import type { Prisma } from '@prisma/client';

/** Atomically claim a draft request for submission within the caller's organisation. */
export async function claimPurchaseRequestSubmission(
  tx: Pick<Prisma.TransactionClient, 'purchaseRequest'>,
  input: { id: string; organizationId: string },
): Promise<boolean> {
  const result = await tx.purchaseRequest.updateMany({
    where: { id: input.id, organizationId: input.organizationId, status: 'DRAFT' },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });
  return result.count === 1;
}
