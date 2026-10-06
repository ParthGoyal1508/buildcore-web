'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getClientBills, type ClientBill } from '@/app/lib/api/billing';
import { BILLING_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import BillSheet from '@/app/ui/projects/bill-sheet';
import ClientBillView from '@/app/ui/projects/client-bill-view';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

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
 * The list is the master now and composing is a **mode** that takes over the panel, the way raising
 * a work order does on Subcontractors. The page opens on the most recent bill, so the common act —
 * looking at what was last sent — costs nothing.
 *
 * ## No tab strip, and that is deliberate
 *
 * Subcontractors has four tabs because a work order has four separate concerns: what was awarded,
 * what has been billed, what is withheld, and what is wrong with the record. A client bill is one
 * document. Four tabs over its two sections would be copying that page's shape rather than its
 * point, which is that one subject fills the panel and is named at all times.
 *
 * ## The sheet still needs the history beside it
 *
 * The cumulative quantity a biller measures against comes from the bills already raised, which is
 * why the two were on one screen to begin with. They still are — the list does not go away while
 * composing, it sits alongside. What changed is which of them you land on.
 */
export default function ClientBillsPanel({ projectId }: { projectId: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const bills = useQuery({
    queryKey: ['clientBills', projectId],
    queryFn: () => getClientBills(projectId),
  });

  // Falls back to the first — the list is newest-first — so the panel is never empty on a project
  // that has bills, but only while nothing has been picked. An explicit choice is never overridden.
  const chosen =
    bills.data?.find((bill) => bill.id === selected) ?? bills.data?.[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">
            {BILLING_COPY.billsHeading}
          </h2>
          <SecondaryButton
            type="button"
            onClick={() => setComposing(true)}
            aria-pressed={composing}
          >
            {BILLING_COPY.composeNew}
          </SecondaryButton>
        </div>

        {bills.isLoading && (
          <p className="text-sm text-gray-500" role="status">
            {BILLING_COPY.boqLoading}
          </p>
        )}
        {bills.isError && (
          <p className="text-sm text-red-700" role="alert">
            {BILLING_COPY.boqLoadFailed}
          </p>
        )}
        {bills.data?.length === 0 && (
          <p className="text-sm text-gray-600">{BILLING_COPY.billsEmpty}</p>
        )}

        <ul className="space-y-2">
          {(bills.data ?? []).map((bill) => (
            <li key={bill.id}>
              <BillRow
                bill={bill}
                current={!composing && chosen?.id === bill.id}
                onPick={() => {
                  setSelected(bill.id);
                  setComposing(false);
                }}
              />
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0">
        {composing ? (
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">
                {BILLING_COPY.composeHeading}
              </h2>
              <SecondaryButton
                type="button"
                onClick={() => setComposing(false)}
              >
                {BILLING_COPY.composeCancel}
              </SecondaryButton>
            </div>
            {/* The sheet keeps its own heading, hint, draft recovery and conflict handling. This
                wraps it rather than reaching inside: what changed is when it is on screen. */}
            <BillSheet projectId={projectId} />
          </section>
        ) : chosen ? (
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
          {rupees(bill.netAmount)}
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
