/**
 * The `?companyId=` suffix every company-scoped endpoint takes (017 FR-021).
 *
 * A helper rather than template literals at each call site because the empty case has to
 * be right everywhere: a cross-company caller who has not chosen yet must send **no**
 * parameter, not `?companyId=undefined`, which the server would read as a named company
 * and refuse. One place to get that wrong instead of twenty.
 *
 * The backend ignores this parameter outright for a caller without cross-company access —
 * a query parameter may never widen a caller's scope — so sending it is always safe.
 */
export function companyQuery(
  companyId?: string | null,
  existingQuery?: string,
): string {
  if (!companyId) return existingQuery ? `?${existingQuery}` : '';
  const query = existingQuery
    ? `${existingQuery}&companyId=${encodeURIComponent(companyId)}`
    : `companyId=${encodeURIComponent(companyId)}`;
  return `?${query}`;
}
