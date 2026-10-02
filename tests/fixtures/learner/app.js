export function adjustQuantity(current, delta) {
  const next = current + delta;
  if (next > 10) return 10;
  return next;
}
