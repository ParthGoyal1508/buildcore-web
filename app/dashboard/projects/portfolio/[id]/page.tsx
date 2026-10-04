'use client';

import Link from 'next/link';

import { PROJECT_SHELL_COPY, ROUTES, projectsLabel } from '@/app/lib/constants';
import { formatDateToLocal, formatRupees } from '@/app/lib/utils';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/** One labelled fact. A definition list, because that is what this is. */
function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{term}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function Card({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{heading}</h2>
      {children}
    </section>
  );
}

/**
 * A project's own page — what it is, and what has happened on it (008 US4, T023).
 *
 * Every figure here comes from the aggregate the shell already fetched, so this page issues no
 * request of its own. That is the point of it: `GET /projects/:id` has been returning the
 * people, the machinery, the materials and three summaries since feature 008 shipped, and
 * until 2026-10-04 this app parsed the project out of that response and threw the rest away.
 *
 * The counts link rather than list. A project with 140 workers on it would bury the contract
 * terms under a roster nobody came here to read, and the roster has a section of its own.
 */
export default function ProjectOverviewPage() {
  const { project, tabs, unavailableModules } = useProjectShell();

  const unavailable = unavailableModules.map(
    (module) => PROJECT_SHELL_COPY.moduleNames[module] ?? module,
  );

  return (
    <div className="flex flex-col gap-6">
      {/*
        "We could not ask" is not "there is none", and the server goes to the trouble of
        telling them apart. Rendered above the counts it qualifies, because a reader who sees
        `Machinery 0` and scrolls no further has been misinformed.
      */}
      {unavailable.length > 0 && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {PROJECT_SHELL_COPY.moduleUnavailable(unavailable)}
        </p>
      )}

      {project.description && (
        <p className="text-sm text-gray-700">{project.description}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card heading={PROJECT_SHELL_COPY.contractHeading}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact term="Contract value">
              <span className="tabular-nums">
                {formatRupees(project.contractValue)}
              </span>
            </Fact>
            <Fact term="Status">{projectsLabel(project.status)}</Fact>
            <Fact term="Start">{formatDateToLocal(project.startDate)}</Fact>
            <Fact term="Expected end">
              {project.expectedEndDate
                ? formatDateToLocal(project.expectedEndDate)
                : '—'}
            </Fact>
            <Fact term="Division">{projectsLabel(project.division)}</Fact>
            <Fact term="Site type">{projectsLabel(project.siteType)}</Fact>
            <Fact term="Order number">{project.orderNumber || '—'}</Fact>
            <Fact term="Purchase limit">
              {project.purchaseLimit === null ? (
                '—'
              ) : (
                <span className="tabular-nums">
                  {formatRupees(project.purchaseLimit)}
                </span>
              )}
            </Fact>
          </dl>
        </Card>

        <Card heading={PROJECT_SHELL_COPY.activityHeading}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact term="Daily work reports">
              {tabs.dwrSummary.count === 0
                ? PROJECT_SHELL_COPY.dwrNone
                : PROJECT_SHELL_COPY.dwrCount(tabs.dwrSummary.count)}
              {tabs.dwrSummary.latestDate && (
                <span className="block text-xs text-gray-500">
                  {PROJECT_SHELL_COPY.dwrLatest(
                    formatDateToLocal(tabs.dwrSummary.latestDate),
                  )}
                </span>
              )}
            </Fact>
            <Fact term="Bills">
              {PROJECT_SHELL_COPY.billsCount(tabs.billSummary.totalBills)}
              <span className="block text-xs tabular-nums text-gray-500">
                {formatRupees(tabs.billSummary.totalExpenses)}
              </span>
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.revenueReceived}>
              <span className="tabular-nums">
                {formatRupees(tabs.revenueSummary.totalReceived)}
              </span>
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.revenuePending}>
              <span className="tabular-nums">
                {formatRupees(tabs.revenueSummary.totalPending)}
              </span>
            </Fact>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            href: ROUTES.projectsPeople(project.id),
            label: 'People',
            count: tabs.employees.length,
          },
          {
            href: ROUTES.projectsMachinery(project.id),
            label: 'Machinery',
            count: tabs.machinery.length,
          },
          {
            href: ROUTES.projectsMaterials(project.id),
            label: 'Materials',
            count: tabs.materials.length,
          },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {tile.label}
            </p>
            <p className="mt-1 text-2xl tabular-nums text-gray-900">
              {tile.count}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
