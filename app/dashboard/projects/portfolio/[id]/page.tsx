'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';

import { getClients } from '@/app/lib/api/projects';
import { getDocumentRequirements } from '@/app/lib/api/project-documents';
import { PROJECT_SHELL_COPY, ROUTES, projectsLabel } from '@/app/lib/constants';
import { formatDateToLocal, formatRupees } from '@/app/lib/utils';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

/** One labelled fact. A definition list, because that is what this is. */
function Fact({
  term,
  children,
  className,
}: {
  term: string;
  children: React.ReactNode;
  /** For a fact that needs the whole row — the documents list, which is a list. */
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{term}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

/**
 * Worst first: a project cannot start without the red ones, the amber ones are being chased, and
 * the grey ones are done. The same order somebody works in.
 */
const DOCUMENT_STATE_ORDER = { needed: 0, advisory: 1, filed: 2 } as const;

const DOCUMENT_STATE_STYLES = {
  needed: 'bg-red-50 text-red-700 ring-red-600/20',
  advisory: 'bg-amber-50 text-amber-800 ring-amber-200',
  filed: 'bg-gray-50 text-gray-500 ring-gray-200',
} as const;

const DOCUMENT_STATE_LABELS = {
  needed: PROJECT_SHELL_COPY.documentsNeededGroup,
  advisory: PROJECT_SHELL_COPY.documentsAdvisoryGroup,
  filed: PROJECT_SHELL_COPY.documentsFiledGroup,
} as const;

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
  const { project, tabs, documentReadiness, unavailableModules } =
    useProjectShell();

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

  /**
   * How many mandatory documents are still to come — `null` when the company requires
   * none, which is a different sentence from "none outstanding".
   *
   * Subtracted here rather than on the server: the response already carries both
   * figures and the portfolio list renders them the other way round, as "3 of 5". A
   * third field would have made the two screens disagree the first time one of them
   * changed.
   */
  const outstandingDocuments =
    documentReadiness.required === 0
      ? null
      : documentReadiness.required - documentReadiness.present;
  // Both optional on the wire — a client ahead of the server degrades to not reporting
  // the advisory split rather than failing to parse. Zero either way means no line.
  const advisoryOutstanding =
    (documentReadiness.advisoryRequired ?? 0) -
    (documentReadiness.advisoryPresent ?? 0);

  /**
   * The required kinds themselves, named (2026-10-12).
   *
   * Readiness arrives as counts and ids — "1 still to upload" — which raises exactly the question
   * it does not answer. The names come from the required set, under the same query key the
   * Documents tab and the settings screen already use, so for anybody who has opened either this
   * is a cache read rather than a request.
   */
  const requirementSet = useQuery({
    queryKey: ['projectDocumentRequirements'],
    queryFn: () => getDocumentRequirements(),
  });

  /**
   * Every kind this project owes, worst first.
   *
   * Three states, and the order is the order somebody acts in: a mandatory kind still missing
   * stops the project and is red; an advisory one is being chased and is amber; one already filed
   * is neither, and is shown grey rather than hidden — "which documents does this project need"
   * and "which are missing" are different questions, and the card can answer both in one line.
   *
   * Derived from the ids readiness already sends rather than from a second count, so this list and
   * the figure above it cannot disagree. An id with no kind behind it is dropped: the server
   * computes both from the same set, so it would mean the set changed under the page.
   */
  const documentKinds = (() => {
    const missing = new Set(documentReadiness.missingTypeIds);
    const advisoryMissing = new Set(
      documentReadiness.advisoryMissingTypeIds ?? [],
    );
    return (requirementSet.data?.requirements ?? [])
      .map((kind) => ({
        id: kind.documentTypeId,
        name: kind.name,
        state: missing.has(kind.documentTypeId)
          ? ('needed' as const)
          : advisoryMissing.has(kind.documentTypeId)
            ? ('advisory' as const)
            : ('filed' as const),
      }))
      .sort(
        (a, b) =>
          DOCUMENT_STATE_ORDER[a.state] - DOCUMENT_STATE_ORDER[b.state] ||
          a.name.localeCompare(b.name),
      );
  })();

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
            {/*
              **Both directions, named** (2026-10-12). This said "Bills" and counted `RABill`
              alone, on a screen whose tabs are "Client bills" and "RA bills" — so the figure
              could have been either and was the one about money going out. The client side was
              absent from the card entirely.
            */}
            <Fact term={PROJECT_SHELL_COPY.subcontractorBillsLabel}>
              {PROJECT_SHELL_COPY.billsCount(tabs.billSummary.totalBills)}
              <span className="block text-xs tabular-nums text-gray-500">
                {formatRupees(tabs.billSummary.totalExpenses)}
              </span>
            </Fact>
            <Fact term={PROJECT_SHELL_COPY.clientBillsLabel}>
              {tabs.clientBillSummary.totalBills === 0
                ? PROJECT_SHELL_COPY.clientBillsNone
                : PROJECT_SHELL_COPY.clientBillsCount(
                    tabs.clientBillSummary.totalBills,
                  )}
              {tabs.clientBillSummary.totalBills > 0 && (
                <span className="block text-xs tabular-nums text-gray-500">
                  {PROJECT_SHELL_COPY.clientBillsBilled(
                    formatRupees(tabs.clientBillSummary.totalBilled),
                  )}
                </span>
              )}
            </Fact>
            {/*
              Beside what was billed, never instead of it. The gap between the two is what a
              project manager chases, and one figure can only say one of them.
            */}
            <Fact term={PROJECT_SHELL_COPY.certifiedLabel}>
              {tabs.clientBillSummary.certifiedCount === 0 ? (
                <span className="text-gray-500">
                  {PROJECT_SHELL_COPY.certifiedNone}
                </span>
              ) : (
                <>
                  <span className="tabular-nums">
                    {formatRupees(tabs.clientBillSummary.totalCertified)}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {PROJECT_SHELL_COPY.certifiedOf(
                      tabs.clientBillSummary.certifiedCount,
                      tabs.clientBillSummary.totalBills,
                    )}
                  </span>
                </>
              )}
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
            <Fact
              term={PROJECT_SHELL_COPY.documentsLabel}
              className="col-span-2"
            >
              <Link
                href={ROUTES.projectsProjectDocuments(project.id)}
                className="text-blue-600 hover:underline"
              >
                {outstandingDocuments === null
                  ? PROJECT_SHELL_COPY.documentsNoneRequired
                  : outstandingDocuments === 0
                    ? PROJECT_SHELL_COPY.documentsComplete
                    : PROJECT_SHELL_COPY.documentsOutstanding(
                        outstandingDocuments,
                      )}
              </Link>
              {advisoryOutstanding > 0 && (
                <span className="block text-xs text-gray-500">
                  {PROJECT_SHELL_COPY.documentsAdvisoryOutstanding(
                    advisoryOutstanding,
                  )}
                </span>
              )}
              {/*
                The kinds by name, red for one that stops the project and amber for one that can
                follow. A list, because it is one — and each carries its state in words as well as
                in colour, which is the half a reader who cannot tell red from amber needs.
              */}
              {documentKinds.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {documentKinds.map((kind) => (
                    <li key={kind.id}>
                      <span
                        className={clsx(
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                          DOCUMENT_STATE_STYLES[kind.state],
                        )}
                      >
                        <span className="sr-only">
                          {DOCUMENT_STATE_LABELS[kind.state]}:{' '}
                        </span>
                        {kind.state === 'filed' && (
                          <span aria-hidden="true" className="mr-1">
                            ✓
                          </span>
                        )}
                        {kind.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
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
