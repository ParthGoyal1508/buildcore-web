'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getClients } from '@/app/lib/api/projects';
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
 * Every figure here comes from the aggregate the shell already fetched. That is the point of it:
 * `GET /projects/:id` has been returning the people, the machinery, the materials and three
 * summaries since feature 008 shipped, and until 2026-10-04 this app parsed the project out of that
 * response and threw the rest away.
 *
 * The counts link rather than list. A project with 140 workers on it would bury the contract
 * terms under a roster nobody came here to read, and the roster has a section of its own.
 *
 * ## 028 FR-029: thirteen facts, and the rest already in the response
 *
 * The page rendered thirteen fields of a response carrying twenty-odd. Client, manager, location,
 * department, project type, site start and CGST were all there and none reached the screen —
 * **this phase makes no API change**, because there was nothing to add.
 *
 * Retention and the quoted percentage get a **card of their own**. They are not descriptive facts:
 * they are the terms money is computed under, and each is a refusal waiting to happen — a bill to
 * the client is refused until retention is recorded, and the quoted percentage prices every line of
 * the schedule. Among twelve Contract fields they read as two more fields.
 *
 * ## The two names, and the one request this page now makes
 *
 * `clientId` and `projectManagerEmployeeId` are ids, and an id on a screen names nobody. The
 * manager is resolved from `tabs.employees`, which the shell already has — and where they are not
 * on the roster the page **says so** rather than printing an id or a blank, because "recorded but
 * not deployed here" is a real and different state.
 *
 * The client needs the client list, which is one cached request under the key the portfolio filter
 * already uses — so in practice it is already in the cache by the time anybody reaches a project.
 * The docblock used to say this page issues no request of its own; it issues this one, and saying
 * so is cheaper than leaving the next reader to find out.
 */
export default function ProjectOverviewPage() {
  const { project, tabs, unavailableModules } = useProjectShell();

  const unavailable = unavailableModules.map(
    (module) => PROJECT_SHELL_COPY.moduleNames[module] ?? module,
  );

  // The same key the portfolio's client filter uses, so this is a cache read for anybody who
  // arrived through the list — which is everybody.
  const { data: clients } = useQuery({
    queryKey: ['projects', 'clients', { pageSize: 200 }],
    queryFn: () => getClients({ pageSize: 200 }),
  });
  const clientName =
    clients?.items.find((client) => client.id === project.clientId)?.name ??
    null;

  const manager = project.projectManagerEmployeeId
    ? (tabs.employees.find(
        (employee) => employee.id === project.projectManagerEmployeeId,
      )?.name ?? PROJECT_SHELL_COPY.managerUnknown)
    : null;

  const quoted =
    project.quotedPercentage == null ? null : Number(project.quotedPercentage);

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card heading={PROJECT_SHELL_COPY.detailsHeading}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Fact term={PROJECT_SHELL_COPY.clientLabel}>
              {clientName ?? PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.managerLabel}>
              {manager ?? PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.locationLabel}>
              {project.location || PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.departmentLabel}>
              {project.departmentType || PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.projectTypeLabel}>
              {project.projectType || PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.siteStartLabel}>
              {project.siteStartDate
                ? formatDateToLocal(project.siteStartDate)
                : PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.cgstLabel}>
              {project.cgstApplicable
                ? PROJECT_SHELL_COPY.cgstApplicable
                : PROJECT_SHELL_COPY.cgstNotApplicable}
            </Fact>
          </dl>
        </Card>

        <Card heading={PROJECT_SHELL_COPY.commercialHeading}>
          <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <Fact term={PROJECT_SHELL_COPY.retentionLabel}>
              {project.clientRetentionFraction == null ? (
                // Null is not zero. The sentence says what the absence causes, because the next
                // thing that happens to a reader who ignores it is a refused bill.
                <span className="text-amber-800">
                  {PROJECT_SHELL_COPY.retentionUnset}
                </span>
              ) : (
                <span className="tabular-nums">
                  {(Number(project.clientRetentionFraction) * 100).toFixed(2)}%
                </span>
              )}
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.quotedLabel}>
              {quoted === null ? (
                PROJECT_SHELL_COPY.notRecorded
              ) : (
                <>
                  <span className="tabular-nums">
                    {/* Signed, and the direction repeated in words below. A magnitude alone is
                        exactly what 027's import defect printed, and it read a tender quoted
                        below the schedule as quoted above it. */}
                    {quoted > 0 ? '+' : quoted < 0 ? '−' : ''}
                    {(Math.abs(quoted) * 100).toFixed(2)}%
                  </span>
                  <span className="block text-xs text-gray-500">
                    {PROJECT_SHELL_COPY.quotedDirection(quoted)}
                  </span>
                </>
              )}
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
