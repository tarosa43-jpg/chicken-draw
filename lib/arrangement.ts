/** Shared arrangement operation for pointer, touch, and keyboard input. */
export function moveInOrder(order: number[], from: number, to: number) {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= order.length ||
    to >= order.length
  )
    return order;
  const next = [...order];
  const [value] = next.splice(from, 1);
  next.splice(to, 0, value);
  return next;
}
