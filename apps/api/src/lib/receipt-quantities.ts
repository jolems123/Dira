/** Validate receipt quantities before persistence or invoice matching. */
export function validReceiptQuantities(input: { receivedQuantity: number; rejectedQuantity: number }): boolean {
  return Number.isFinite(input.receivedQuantity) && Number.isFinite(input.rejectedQuantity)
    && input.receivedQuantity >= 0 && input.rejectedQuantity >= 0
    && input.rejectedQuantity <= input.receivedQuantity;
}
