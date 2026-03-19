export const ORDER_GAP = 65536;

export function calculateMovedIssueOrder(input: {
  previousOrder: number | null;
  nextOrder: number | null;
}) {
  const { previousOrder, nextOrder } = input;

  if (previousOrder === null && nextOrder === null) {
    return ORDER_GAP;
  }

  if (previousOrder !== null && nextOrder !== null) {
    if (previousOrder >= nextOrder) {
      return null;
    }

    const midpoint = previousOrder + Math.floor((nextOrder - previousOrder) / 2);
    if (midpoint <= previousOrder || midpoint >= nextOrder) {
      return null;
    }

    return midpoint;
  }

  if (previousOrder !== null) {
    const order = previousOrder + ORDER_GAP;
    return Number.isSafeInteger(order) ? order : null;
  }

  if (nextOrder === null) {
    return null;
  }

  const order = nextOrder - ORDER_GAP;
  return Number.isSafeInteger(order) ? order : null;
}
