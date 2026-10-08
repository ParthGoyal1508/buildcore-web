import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The three pieces a master's detail page is built from (2026-10-09).
 *
 * Shared between the client and the site page rather than copied into each. They were going to
 * be the same card, the same definition-list row and the same Open link either way, and the
 * project overview page already established exactly this shape — this is that shape, named, so
 * the third master does not produce a third dialect.
 */

/** One labelled fact. A definition list, because that is what this is. */
export function Fact({
  term,
  children,
}: {
  term: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{term}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export function DetailCard({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{heading}</h2>
      {children}
    </section>
  );
}

/**
 * The same "Open" the portfolio row offers, so one control means one thing everywhere.
 *
 * A `Link` and not a button: it is a destination, and middle-clicking it should open a tab.
 */
export function OpenLink({
  href,
  label = 'Open',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {label}
    </Link>
  );
}
