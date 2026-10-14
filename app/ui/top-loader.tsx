'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * A thin bar across the top of the screen while anything is loading (2026-10-15).
 *
 * The client: "In local everything is fast, but after deployment it's little slow." The deployed
 * API is on another continent from most of its readers, so every request costs a round trip a
 * local server never does. This does not make that faster; it makes it visible, so a click that
 * is waiting on the network looks like it is — rather than like a click that did nothing and gets
 * clicked again.
 *
 * Shown for any data request or save in flight (React Query's own counts) and between a link
 * being followed and the new page arriving. It appears only after 150ms, so a quick request does
 * not flash it.
 */
export default function TopLoader() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const pathname = usePathname();
  const [navigatingFrom, setNavigatingFrom] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // A link to another page of the app starts the bar; the page arriving ends it.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Not `defaultPrevented`: Next's `<Link>` prevents every click it handles, which is every
      // one this is for.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank')
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      setNavigatingFrom(window.location.pathname);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const navigating = navigatingFrom !== null && navigatingFrom === pathname;
  const busy = fetching + mutating > 0 || navigating;

  useEffect(() => {
    if (!busy) {
      const id = setTimeout(() => setVisible(false), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(id);
  }, [busy]);

  return (
    <div
      aria-hidden="true"
      data-top-loader={visible ? 'on' : 'off'}
      className={`pointer-events-none fixed inset-x-0 top-0 z-[1200] h-[3px] overflow-hidden transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="h-full w-1/3 animate-top-loader rounded-full bg-gradient-to-r from-accent-400 via-accent-300 to-emerald-300 shadow-[0_0_8px_rgba(56,189,248,0.7)]" />
    </div>
  );
}
