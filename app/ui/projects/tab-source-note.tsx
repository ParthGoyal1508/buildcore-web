'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getSites } from '@/app/lib/api/projects';
import { PROJECT_TAB_SOURCES, ROUTES } from '@/app/lib/constants';

/**
 * Says where a read-only project tab's contents come from, and links there (027).
 *
 * ## The gap this closes
 *
 * People, machinery and material reach a project **through its sites**: an employee posted to one,
 * a machine deployed to one, stock issued from one. The three tabs are mirrors of that and are
 * read-only on purpose — a roster editable from two places is two places for it to disagree.
 *
 * But nothing on the screen said so. An empty People tab looked exactly like a People tab with an
 * Add button somebody had forgotten to build, and the reader's conclusion was that the product
 * could not do it. "There is nothing here" and "you do this in HR" are different facts and the
 * screen was showing neither.
 *
 * ## The no-sites case is answered first
 *
 * A project with no sites has no route by which any of the three could ever arrive, so sending
 * somebody to HR to post an employee would be sending them to do something that cannot work. That
 * case replaces the note rather than appearing beside it.
 *
 * One query, keyed on the project, so moving between the three tabs reads the cache rather than
 * asking again.
 */
export default function TabSourceNote({
  projectId,
  /** What this tab's contents are, and where they are actually set. */
  explanation,
  linkLabel,
  href,
  /** A second place to go, where one step is not enough — materials needs stock before an issue. */
  secondLinkLabel,
  secondHref,
}: {
  projectId: string;
  explanation: string;
  linkLabel: string;
  href: string;
  secondLinkLabel?: string;
  secondHref?: string;
}) {
  const sites = useQuery({
    queryKey: ['projects', 'sites', projectId],
    queryFn: () => getSites({ projectId, pageSize: 100 }),
  });

  // Silent while unknown. A note that flickers from "no sites" to "its sites are…" would state the
  // more alarming of the two first, and be wrong about it.
  if (!sites.data) return null;

  const names = sites.data.items.map((site) => site.name);

  if (names.length === 0) {
    return (
      <Note>
        {PROJECT_TAB_SOURCES.noSites}{' '}
        <Action href={ROUTES.projectsSites}>
          {PROJECT_TAB_SOURCES.noSitesLink}
        </Action>
      </Note>
    );
  }

  return (
    <Note>
      {explanation}{' '}
      <span className="text-gray-500">
        {PROJECT_TAB_SOURCES.sitesLabel(names.join(', '))}
      </span>{' '}
      <Action href={href}>{linkLabel}</Action>
      {secondHref && secondLinkLabel && (
        <>
          {' · '}
          <Action href={secondHref}>{secondLinkLabel}</Action>
        </>
      )}
    </Note>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
      {children}
    </p>
  );
}

function Action({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="whitespace-nowrap font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {children}
    </Link>
  );
}
