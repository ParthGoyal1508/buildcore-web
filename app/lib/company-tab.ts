/**
 * Which company this tab believes it is working in, and the alarm for when that stops being true
 * (036 B17, decision "detect and warn").
 *
 * The selected company is stored **per user** on the server, not per tab. Switching company in one
 * tab silently moved every other open tab too — their screens still showed the old company's rows,
 * and a save made from one of them landed in the new company. The client does not try to make the
 * selection per-tab (that is a server design question, settled as "one selection per user"); it
 * makes the mismatch *visible*:
 *
 * - every authenticated request carries `X-Expected-Company-Id` — the company this tab last knew it
 *   was in — so the server can refuse a save from a stale tab with a 409 `COMPANY_CHANGED`;
 * - every response may carry `X-Company-Id` — the company it was served for — and a difference from
 *   what this tab believes raises the banner (`CompanyChangedBanner`);
 * - the tab that switches tells the others at once over a `BroadcastChannel`, so they do not have
 *   to wait for their next request to find out.
 *
 * **Harmless without the server half.** No response header means nothing is compared, and the
 * request header is same-origin (through the `/bff` proxy), so it needs no CORS allowance.
 *
 * A leaf module with no imports, because `app/lib/api/client.ts` reads it on every response and
 * must not pull the session or React in with it.
 *
 * ## Contract (for the server agent)
 *
 * - Request: `X-Expected-Company-Id: <uuid>` when the tab believes a company is selected. **Omitted**
 *   when it believes "all companies" (a cross-company caller with no selection) or does not know yet.
 * - Response: `X-Company-Id: <uuid>`, or an empty value / `none` for "no company selected".
 * - Refusal: 409 with `code: 'COMPANY_CHANGED'`; `companyName` / `companyId` in the body are used for
 *   the banner when present.
 */

export const EXPECTED_COMPANY_HEADER = 'X-Expected-Company-Id';
export const SERVED_COMPANY_HEADER = 'X-Company-Id';
export const COMPANY_CHANGED = 'COMPANY_CHANGED';

/** What this tab believes. An object so a request can tell whether the belief moved under it. */
export interface CompanyBelief {
  id: string | null;
}

/** `undefined` until the selectable list has loaded once: nothing to compare against before that. */
let belief: CompanyBelief | undefined;
/** True while this tab's own switch is on the wire; responses during it are ambiguous. */
let switching = false;
const names = new Map<string, string>();

/** Set once a mismatch is seen. Never cleared: the way out is the Reload button. */
export interface CompanyChange {
  /** The company the server now says is selected; null for "all companies" or unknown. */
  name: string | null;
}
let change: CompanyChange | null = null;
const listeners = new Set<() => void>();

export function subscribeCompanyChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getCompanyChange(): CompanyChange | null {
  return change;
}

function flag(companyId: string | null, name?: string | null) {
  if (change) return;
  change = {
    name: name ?? (companyId ? (names.get(companyId) ?? null) : null),
  };
  listeners.forEach((listener) => listener());
}

const CHANNEL = 'tirupati-company';
let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel =
    typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(CHANNEL)
      : null;
  channel?.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { companyId?: string | null; name?: string };
    if (!data || !('companyId' in data) || belief === undefined || switching)
      return;
    if (data.name && data.companyId) names.set(data.companyId, data.name);
    if ((data.companyId ?? null) !== belief.id) flag(data.companyId ?? null);
  });
  return channel;
}

/** The current belief, captured when a request starts — see `noteServedCompany`. */
export function currentBelief(): CompanyBelief | undefined {
  // Opened lazily on first use so other tabs' switches are heard from the first request on.
  getChannel();
  return belief;
}

/** The request header for the current belief; empty when there is nothing to assert. */
export function expectedCompanyHeaders(): Record<string, string> {
  return belief?.id ? { [EXPECTED_COMPANY_HEADER]: belief.id } : {};
}

/** Marks this tab's own switch as started, so responses racing it are not read as another tab's. */
export function beginOwnSwitch() {
  switching = true;
}
/** The switch failed: nothing changed, keep the old belief. */
export function abandonOwnSwitch() {
  switching = false;
}

/**
 * The selectable list arrived. `own` is true for the response to this tab's own switch.
 *
 * The first list sets the belief. A later one that names a different company was not this tab's
 * doing — another tab switched — so it raises the banner instead of quietly adopting the new
 * company over a cache full of the old one's rows.
 */
export function noteCompanyList(
  companies: { id: string; name: string; selected: boolean }[],
  own = false,
) {
  for (const company of companies) names.set(company.id, company.name);
  const selected = companies.find((company) => company.selected) ?? null;
  const id = selected?.id ?? null;
  if (own) {
    belief = { id };
    switching = false;
    getChannel()?.postMessage({ companyId: id, name: selected?.name });
    return;
  }
  if (belief === undefined) {
    belief = { id };
    return;
  }
  if (!switching && id !== belief.id) flag(id);
}

/**
 * A response arrived; compares the company it was served for with what this tab believed **when
 * the request was sent**. A request that started before this tab's own switch finished legitimately
 * comes back for the old company, so it is ignored rather than mistaken for another tab's switch.
 */
export function noteServedCompany(
  res: Response,
  sentWith: CompanyBelief | undefined,
) {
  const header = res.headers.get(SERVED_COMPANY_HEADER);
  if (header === null || sentWith === undefined || switching) return;
  // A cacheable response (company logos and equipment photos are cached for a year) may be the
  // browser's stored copy, replaying the header from whenever it was first fetched. It says
  // nothing about the selection now — reading it as one raised the banner on every reload.
  if (/max-age=[1-9]/.test(res.headers.get('Cache-Control') ?? '')) return;
  if (sentWith !== belief) return;
  const id = header === '' || header === 'none' ? null : header;
  if (id !== sentWith.id) flag(id);
}

/** A 409 `COMPANY_CHANGED` refusal: the server says outright that the tab is stale. */
export function noteCompanyChangedRefusal(details: Record<string, unknown>) {
  const id = typeof details.companyId === 'string' ? details.companyId : null;
  const name =
    typeof details.companyName === 'string' ? details.companyName : null;
  flag(id, name);
}
