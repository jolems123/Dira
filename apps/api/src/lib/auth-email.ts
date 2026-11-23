/** Normalize email input before validation and lookup. Validation remains the caller's responsibility. */
export function canonicalEmail(value: string): string {
  return value.trim().toLowerCase();
}
