/**
 * Whether a click follows a link to another page of the app — what starts the top loading bar
 * and the page skeleton. One test for both, so they never disagree.
 *
 * A download is not a page change (2026-10-15): the RA bill's Word download is a link to a
 * `blob:` URL, whose origin is the app's own, so it read as navigation — the skeleton covered
 * the bill and waited for an address change that never came. Links with `download`, and any
 * URL that is not http(s), are skipped.
 */
export function isPageLinkClick(event: MouseEvent): boolean {
  // Not `defaultPrevented`: Next's `<Link>` prevents every click it handles, which is every one
  // this is for.
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  const link = (event.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return false;
  if (link.target === '_blank' || link.hasAttribute('download')) return false;
  const url = new URL(link.href, window.location.href);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname;
}
