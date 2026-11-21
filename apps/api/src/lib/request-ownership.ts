/** A draft may only be submitted by the user who created it. */
export function maySubmitPurchaseRequest(requestedBy: string | null | undefined, actorId: string | null | undefined): boolean {
  return Boolean(requestedBy && actorId && requestedBy === actorId);
}
