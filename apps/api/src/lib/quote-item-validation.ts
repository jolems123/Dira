/** Reject duplicate and foreign RFQ line references before pricing or persistence. */
export function validateQuotedRfqItems(submittedIds: string[], allowedIds: string[]): string | null {
  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  for (const id of submittedIds) {
    if (!allowed.has(id)) return `Invalid RFQ item: ${id}`;
    if (seen.has(id)) return `Duplicate RFQ item: ${id}`;
    seen.add(id);
  }
  return null;
}
