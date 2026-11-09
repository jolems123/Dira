/** A PO line may appear at most once within a single dispatch or receipt payload. */
export function hasUniqueOrderLineIds(lines: ReadonlyArray<{ purchaseOrderItemId: string }>): boolean {
  const ids = lines.map((line) => line.purchaseOrderItemId);
  return new Set(ids).size === ids.length;
}
