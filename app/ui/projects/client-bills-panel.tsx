'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import Link from 'next/link';

import {
  BILLING_PAGE_SIZE,
  getClientBillsPage,
  type ClientBill,
} from '@/app/lib/api/billing';
import { BILLING_COPY, ROUTES } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import ClientBillView from '@/app/ui/projects/client-bill-view';
import QueryError from '@/app/ui/query-error';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';

/**
 * Client bills for one project: the bills down the left, one of them filling the right (027).
 *
 * ## What this replaces
 *
 * The page was a 231-row editable BOQ sheet with the bills raised stacked underneath it. You landed
 * on a form whether or not you were composing; reading a bill meant scrolling past it to a history
 * table of five totals; and the bill's own lines existed nowhere at all — only inside the sheet that
 * creates the next one.
 *
 * The list is the master. New bills are generated as bill packages — proposed from approved daily
 * work, approved, issued and certified — so this panel reads them rather than composing them
 * (2026-10-13). The page opens on the most recent bill, so the common act — looking at what was
 * last sent — costs nothing.
 *
 * ## No tab strip, and that is deliberate
 *
 * Subcontractors has four tabs because a work order has four separate concerns: what was awarded,
 * what has been billed, what is withheld, and what is wrong with the record. A client bill is one
 * document. Four tabs over its two sections would be copying that page's shape rather than its
 * point, which is that one subject fills the panel and is named at all times.
 *
 */
export default function ClientBillsPanel({ projectId }: { projectId: string }) {
  /**
   * The picked bill, kept whole rather than by id (036 I26, 2026-10-17): with the list paged, the
   * bill being read may be on a page the list has since moved off, and the panel must not swap to
   * a different bill because somebody pressed Next.
   */
  const [picked, setPicked] = useState<ClientBill | null>(null);
  const [page, setPage] = useState(1);

  /**
   * 036 I26: a page at a time, newest first, with the total. Keyed under `['clientBills',
   * projectId]` so every existing invalidation of that prefix (certify, the bill sheet) refreshes
   * it. `keepPreviousData` so Next does not blank the list while the next page loads.
   */
  const bills = useQuery({
    queryKey: ['clientBills', projectId, 'page', page],
    queryFn: () => getClientBillsPage(projectId, page, BILLING_PAGE_SIZE),
    placeholderData: keepPreviousData,
  });
  const rows = bills.data?.items;
  const total = bills.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / BILLING_PAGE_SIZE));

  // Falls back to the first — the list is newest-first — so the panel is never empty on a project
  // that has bills, but only while nothing has been picked. An explicit choice is never overridden;
  // the fresh copy from the current page wins when it is there, so a certify shows its new state.
  const chosen =
    (picked && (rows?.find((bill) => bill.id === picked.id) ?? picked)) ??
    rows?.[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          {BILLING_COPY.billsHeading}
        </h2>

        {/*
          Two routes, and the proposed one leads (028 FR-007).

          The bill package proposes every quantity from the daily work approved in the period, for a
          client bill exactly as it does for a subcontractor's. It has done since 023 and was
          reachable only from another tab — so this screen's manual sheet was the obvious route, and
          it is the one that reads nothing the site recorded. Typing quantities against a 231-line
          schedule when the application already knows what was built is work done twice, and the
          typed answer is the one nobody can check.

          The sheet stays, labelled for what it is good at: scope measured outside a daily report.
        */}
        <div className="space-y-2 rounded border border-gray-200 p-3">
          <Link
            href={ROUTES.projectsBillPackages(projectId)}
            className="block min-h-11 rounded bg-blue-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {BILLING_COPY.composeFromWork}
          </Link>
          <p className="text-xs text-gray-500">
            {BILLING_COPY.composeFromWorkHint} Each bill goes through approval
            before it is issued, then is certified by the client.
          </p>
        </div>

        {bills.isLoading && (
          <div role="status" aria-label={BILLING_COPY.boqLoading}>
            <ListSkeleton headers={[BILLING_COPY.billsHeading]} rows={3} cards />
          </div>
        )}
        {/* 036 I17: the failure with a retry, not a red line that reads as the end of the matter. */}
        {bills.isError && (
          <QueryError
            compact
            error={bills.error}
            fallback="The client bills could not be loaded."
            onRetry={bills.refetch}
          />
        )}
        {rows?.length === 0 && (
          <p className="text-sm text-gray-600">{BILLING_COPY.billsEmpty}</p>
        )}

        <ul
          className={`space-y-2 ${bills.isPlaceholderData ? 'opacity-60' : ''}`}
          aria-busy={bills.isPlaceholderData || undefined}
        >
          {(rows ?? []).map((bill) => (
            <li key={bill.id}>
              <BillRow
                bill={bill}
                current={chosen?.id === bill.id}
                onPick={() => setPicked(bill)}
              />
            </li>
          ))}
        </ul>

        {total > BILLING_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
            <SecondaryButton
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </SecondaryButton>
            <span>{`Page ${page} of ${pages} · ${total} bills`}</span>
            <SecondaryButton
              type="button"
              disabled={page >= pages || bills.isPlaceholderData}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </SecondaryButton>
          </div>
        )}
      </aside>

      <div className="min-w-0">
        {chosen ? (
          <ClientBillView projectId={projectId} bill={chosen} />
        ) : (
          !bills.isLoading && (
            <p className="text-sm text-gray-600">
              {BILLING_COPY.pickBillPrompt}
            </p>
          )
        )}
      </div>
    </div>
  );
}

/**
 * One row of the master list.
 *
 * Carries the shortfall, because a bill certified short is the one a reader is looking for and
 * finding it by opening each bill in turn is how it goes unnoticed for a month.
 */
function BillRow({
  bill,
  current,
  onPick,
}: {
  bill: ClientBill;
  current: boolean;
  onPick: () => void;
}) {
  const shortfall =
    bill.certificationVariance !== null && bill.certificationVariance !== 0;

  return (
    <button
      type="button"
      onClick={onPick}
      aria-current={current ? 'true' : undefined}
      className={`min-h-11 w-full rounded border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
        current
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-gray-900">{bill.billNumber}</span>
        <span className="tabular-nums text-gray-900">
          {bill.netAmount === null ? (
            <span className="text-xs font-normal text-gray-500">
              {BILLING_COPY.netNotYetSettled}
            </span>
          ) : (
            rupees(bill.netAmount)
          )}
        </span>
      </span>
      <span className="mt-0.5 block text-xs text-gray-500">
        {`${dateLabel(bill.billingDate)} · ${
          BILLING_COPY.statusLabels[bill.status] ?? bill.status
        }`}
      </span>
      {shortfall && (
        <span className="mt-0.5 block text-xs text-amber-900">
          {BILLING_COPY.certifiedShort(
            rupees(bill.certificationVariance ?? 0),
          )}
        </span>
      )}
    </button>
  );
}
