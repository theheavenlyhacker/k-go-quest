/**
 * Orders two version strings.
 *
 * Each part is compared as a number where both sides are numeric and as text
 * otherwise, so an unexpected version string such as `1.0.0-beta` still orders
 * consistently instead of throwing.
 */
export function compareVersions(left: string, right: string): number {
  const split = (value: string) =>
    value.split(/[.\-+]/).filter((part) => part.length > 0);
  const leftParts = split(left);
  const rightParts = split(right);
  const numeric = (part: string | undefined) =>
    part !== undefined && /^\d+$/.test(part);
  for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i += 1) {
    const one = leftParts[i];
    const two = rightParts[i];
    if (one === undefined || two === undefined) {
      if (!numeric(one ?? two)) return one === undefined ? 1 : -1;
    }
    const a = one ?? '0';
    const b = two ?? '0';
    const order =
      numeric(a) && numeric(b) ? Number(a) - Number(b) : a.localeCompare(b);
    if (order !== 0) return order;
  }
  return 0;
}
