'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';

import { getClients } from '@/app/lib/api/projects';
import { getDocumentRequirements } from '@/app/lib/api/project-documents';
import { PROJECT_SHELL_COPY, ROUTES, projectsLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';
import { useBranches } from '@/app/ui/use-branch-names';
import { TABLE } from '@/app/ui/table';
import { dateLabel } from '@/app/lib/format';

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

/**
 * One figure in the billing table, with its bill count under it.
 *
 * `tabular-nums` so the columns line up digit for digit — two money columns that do not are two
 * columns nobody can compare at a glance, which is the only reason to put them side by side.
 */
function Amount({
  amount,
  note,
  strong,
}: {
  amount: number;
  note?: string;
  strong?: boolean;
}) {
  return (
    <td className={clsx(TABLE.td, TABLE.numeric)}>
      <span
        className={clsx('tabular-nums', strong && 'font-medium text-gray-900')}
      >
        {formatRupees(amount)}
      </span>
      {note && <span className="block text-xs text-gray-500">{note}</span>}
    </td>
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

  const branches = useBranches(project.companyId);
  const branch = branches.nameOf(project.branchId);
  const branchGstin =
    branches.branches.find((b) => b.id === project.branchId)?.gstin ?? null;

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
            {/* 041: near the top, not in Details below the billing table where nobody scrolls to. */}
            <Fact term={PROJECT_SHELL_COPY.branchLabel}>
              {branch ?? PROJECT_SHELL_COPY.notRecorded}
            </Fact>
            <Fact term="GSTIN">{branchGstin ?? '—'}</Fact>
            <Fact term="Start">{dateLabel(project.startDate)}</Fact>
            <Fact term="Expected end">
              {project.expectedEndDate
                ? dateLabel(project.expectedEndDate)
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
                    dateLabel(tabs.dwrSummary.latestDate),
                  )}
                </span>
              )}
            </Fact>
            <Fact
              term={PROJECT_SHELL_COPY.documentsLabel}
              className="col-span-2"
            >
              <Link
                href={ROUTES.projectsProjectDocuments(project.id)}
                className="text-brand-600 hover:underline"
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

      {/*
        **Billing has a card of its own** (2026-10-12). It was one line reading "Bills", which
        counted subcontractor claims and said nothing about the client side at all — on a project
        whose own tabs are "Client bills" and "RA bills".

        A table because it is one: two directions, the same three states, read across. Raised,
        certified and paid are three different questions, and the two gaps between them — claimed
        but not agreed, agreed but not paid — are the whole of what somebody chases.
      */}
      <Card heading={PROJECT_SHELL_COPY.billingHeading}>
        {/* Capped rather than stretched across a full-width card: two money columns a page apart
            are two columns nobody compares, which is the only reason to put them side by side.
            The shared look but no sorting (2026-10-15): the rows are the stages of a bill, in
            the order a bill passes through them. */}
        <div className={clsx(TABLE.wrap, 'max-w-2xl')}>
          <table className={clsx(TABLE.table, 'w-full')}>
            <thead className={TABLE.thead}>
              <tr>
                <th scope="col" className={TABLE.th}>
                  <span className="sr-only">Stage</span>
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {PROJECT_SHELL_COPY.clientBillsLabel}
                </th>
                <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                  {PROJECT_SHELL_COPY.subcontractorBillsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className={TABLE.row}>
                <th
                  scope="row"
                  className={clsx(
                    TABLE.td,
                    'text-left font-normal text-gray-700',
                  )}
                >
                  {PROJECT_SHELL_COPY.billingRaised}
                </th>
                <Amount
                  amount={tabs.clientBillSummary.totalBilled}
                  note={PROJECT_SHELL_COPY.billingCount(
                    tabs.clientBillSummary.totalBills,
                  )}
                />
                <Amount
                  amount={tabs.billSummary.totalExpenses}
                  note={PROJECT_SHELL_COPY.billingCount(
                    tabs.billSummary.totalBills,
                  )}
                />
              </tr>
              <tr className={TABLE.row}>
                <th
                  scope="row"
                  className={clsx(
                    TABLE.td,
                    'text-left font-normal text-gray-700',
                  )}
                >
                  {PROJECT_SHELL_COPY.billingCertified}
                </th>
                <Amount
                  amount={tabs.clientBillSummary.totalCertified}
                  note={PROJECT_SHELL_COPY.billingCount(
                    tabs.clientBillSummary.certifiedCount,
                  )}
                />
                <Amount
                  amount={tabs.billSummary.certifiedAmount}
                  note={PROJECT_SHELL_COPY.billingCount(
                    tabs.billSummary.certifiedBills,
                  )}
                />
              </tr>
              <tr className={TABLE.row}>
                <th
                  scope="row"
                  className={clsx(
                    TABLE.td,
                    'text-left font-normal text-gray-700',
                  )}
                >
                  {PROJECT_SHELL_COPY.billingSettled}
                </th>
                {/* Not a zero. Nothing records a receipt against a client bill, and ₹0 would read
                    as "they have paid nothing" — a claim this system cannot make. */}
                <td
                  className={clsx(TABLE.td, 'text-right text-xs text-gray-500')}
                >
                  {PROJECT_SHELL_COPY.billingClientReceiptsUnrecorded}
                </td>
                <Amount amount={tabs.billSummary.paidAmount} />
              </tr>
              <tr className={TABLE.row}>
                <th
                  scope="row"
                  className={clsx(
                    TABLE.td,
                    'text-left font-normal text-gray-700',
                  )}
                >
                  {PROJECT_SHELL_COPY.billingOutstanding}
                </th>
                <td className={clsx(TABLE.td, 'text-right text-gray-500')}>
                  —
                </td>
                <Amount amount={tabs.billSummary.outstandingAmount} strong />
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {PROJECT_SHELL_COPY.billingClientReceiptsNote}
        </p>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <h3 className="text-xs uppercase tracking-wide text-gray-500">
            {PROJECT_SHELL_COPY.billingRevenueHeading}
          </h3>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
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
        </div>
      </Card>

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
                ? dateLabel(project.siteStartDate)
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
            className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
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
