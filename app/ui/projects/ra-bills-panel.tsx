'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createWorkOrder,
  getRaBills,
  getWorkOrders,
  updateWorkOrder,
  submitRaBill,
  type RaBill,
  type WorkOrder,
} from '@/app/lib/api/billing';
import { getVendors } from '@/app/lib/api/partners';
import { BILLING_COPY, WORK_ORDER_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import AwardEditor from '@/app/ui/projects/award-editor';
import RaBillSheet from '@/app/ui/projects/ra-bill-sheet';
import RaBillView from '@/app/ui/projects/ra-bill-view';
import RetentionLedger from '@/app/ui/projects/retention-ledger';
import SearchableSelect, {
  type SearchableOption,
} from '@/app/ui/searchable-select';
import {
  FieldLabelSpacer,
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';

const TABS = ['award', 'bills', 'retention', 'settings'] as const;
type Tab = (typeof TABS)[number];

/**
 * Subcontractor work orders and the bills measured against them (018 US2 — `bugs.md` item 12).
 *
 * ## Master–detail, because five sections were silently acting on one of them (027)
 *
 * This screen used to be seven stacked sections, of which five — the award capture, the correction
 * form, the retention ledger, the bill sheet and the revise action — all operated on *the selected
 * work order* while only the list at the top said which one that was. Scrolling past the list meant
 * editing a contract whose name was no longer on screen, and with two work orders on a project the
 * reader could not tell whether the retention figure below belonged to the one they had just
 * clicked or the one above it.
 *
 * So the list is the master and everything about one order lives in the panel beside it, under a
 * header that names the contract **at all times**. The four tabs are the four questions actually
 * asked of a subcontract — what did we give them, what have they billed, what are we holding, and
 * what is wrong with the record — and only one is on screen at a time, so no figure is ever
 * adjacent to a figure from a different contract.
 *
 * ## Raising is a mode, not a tab
 *
 * A new work order has no award, no bills and no retention, so it has nothing to put in three of
 * the four tabs. It takes over the panel instead, and the panel returns to the order it creates.
 *
 * ## A bill with no work order is still listed
 *
 * `RaBill.workOrderId` is nullable, so filtering the bill list to the selected order would make a
 * bill raised against the project itself vanish from the screen entirely. Those are listed under
 * the panel instead — fewer places to look than the old flat list, but not one fewer bill.
 */
export default function RaBillsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);
  const [tab, setTab] = useState<Tab>('bills');
  const [revising, setRevising] = useState<RaBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ['workOrders', projectId],
    queryFn: () => getWorkOrders(projectId),
  });
  const bills = useQuery({
    queryKey: ['raBills', projectId],
    queryFn: () => getRaBills(projectId),
  });
  const vendors = useVendorOptions();

  // Falls back to the first order so the panel is never empty on a project that has one, but only
  // while nothing has been picked — an explicit choice is never overridden.
  const chosen =
    orders.data?.find((order) => order.id === selected) ?? orders.data?.[0];

  const vendorName = (partnerId: string | null) =>
    partnerId === null
      ? WORK_ORDER_COPY.vendorNone
      : (vendors.byId.get(partnerId) ?? WORK_ORDER_COPY.vendorUnknown);

  const pick = (id: string) => {
    setSelected(id);
    setRaising(false);
    setRevising(null);
    setError(null);
  };

  const orphanBills = (bills.data ?? []).filter(
    (bill) => bill.workOrderId === null,
  );

  return (
    <div className="space-y-6">
      <FormError message={error} />

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {WORK_ORDER_COPY.heading}
            </h2>
            <SecondaryButton
              type="button"
              onClick={() => {
                setRaising(true);
                setRevising(null);
                setError(null);
              }}
            >
              {WORK_ORDER_COPY.raiseNew}
            </SecondaryButton>
          </div>

          {orders.isLoading && (
            <p className="text-sm text-gray-500" role="status">
              {WORK_ORDER_COPY.loading}
            </p>
          )}
          {orders.isError && (
            <p className="text-sm text-red-700" role="alert">
              {WORK_ORDER_COPY.loadFailed}
            </p>
          )}
          {orders.data?.length === 0 && (
            <p className="text-sm text-gray-600">{WORK_ORDER_COPY.empty}</p>
          )}

          <ul className="space-y-2">
            {(orders.data ?? []).map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => pick(order.id)}
                  aria-current={
                    !raising && chosen?.id === order.id ? 'true' : undefined
                  }
                  className={`min-h-11 w-full rounded border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                    !raising && chosen?.id === order.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {/* The number first, because it is what the subcontractor quotes back. */}
                  <span className="block font-medium tabular-nums text-gray-900">
                    {order.code ?? WORK_ORDER_COPY.unnumbered}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-gray-700">
                    {order.workDetail}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {vendorName(order.partnerId)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0">
          {raising ? (
            <RaiseForm
              projectId={projectId}
              vendors={vendors}
              onCancel={() => setRaising(false)}
              onError={setError}
              onRaised={(order) => {
                setRaising(false);
                setSelected(order.id);
                // A new order has nothing to bill until an award exists, so it opens on the award.
                setTab('award');
                void queryClient.invalidateQueries({
                  queryKey: ['workOrders', projectId],
                });
              }}
            />
          ) : chosen ? (
            <section className="space-y-4">
              <header className="space-y-1 border-b border-gray-200 pb-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-base font-semibold tabular-nums text-gray-900">
                    {chosen.code ?? WORK_ORDER_COPY.unnumbered}
                  </h2>
                  <StatusBadge status={chosen.status} />
                </div>
                <p className="text-sm text-gray-900">{chosen.workDetail}</p>
                <p className="text-sm text-gray-600">
                  {`${WORK_ORDER_COPY.vendorLabel}: ${vendorName(chosen.partnerId)}`}
                </p>
                <p className="text-xs text-gray-500">
                  {WORK_ORDER_COPY.summary(
                    `${(chosen.retentionPercent * 100).toFixed(2)}%`,
                    chosen.awardLineCount,
                    chosen.billCount,
                  )}
                </p>
                {chosen.code === null && (
                  <p className="text-xs text-gray-500">
                    {WORK_ORDER_COPY.unnumberedHint}
                  </p>
                )}
              </header>

              <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-200">
                {TABS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    id={`wo-tab-${name}`}
                    aria-selected={tab === name}
                    aria-controls={`wo-panel-${name}`}
                    onClick={() => setTab(name)}
                    className={`-mb-px min-h-11 border-b-2 px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                      tab === name
                        ? 'border-blue-600 font-semibold text-blue-700'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {WORK_ORDER_COPY.tabs[name]}
                  </button>
                ))}
              </div>

              {/* Keyed on the work order, so switching contracts in the list remounts the panel.
                  Without it the award textarea and the settings fields would keep the previous
                  order's values — an uncontrolled form showing one contract's retention while the
                  header names another. */}
              <div
                key={chosen.id}
                role="tabpanel"
                id={`wo-panel-${tab}`}
                aria-labelledby={`wo-tab-${tab}`}
                className="space-y-4"
              >
                {/* The tab's own one-line explanation: four nouns on their own leave the reader to
                    guess which of them holds the money they are looking for. */}
                <p className="text-sm text-gray-600">
                  {WORK_ORDER_COPY.tabHints[tab]}
                </p>

                {tab === 'award' && (
                  <AwardTab
                    projectId={projectId}
                    order={chosen}
                    onError={setError}
                    onSaved={() => {
                      void queryClient.invalidateQueries({
                        queryKey: ['workOrders', projectId],
                      });
                      void queryClient.invalidateQueries({
                        queryKey: ['raAward', chosen.id],
                      });
                    }}
                  />
                )}

                {tab === 'bills' && (
                  <BillsTab
                    projectId={projectId}
                    order={chosen}
                    bills={(bills.data ?? []).filter(
                      (bill) => bill.workOrderId === chosen.id,
                    )}
                    revising={revising}
                    onRevise={setRevising}
                    onCaptureAward={() => setTab('award')}
                    onError={setError}
                  />
                )}

                {tab === 'retention' && (
                  <RetentionLedger workOrderId={chosen.id} />
                )}

                {tab === 'settings' && (
                  <SettingsTab
                    order={chosen}
                    vendors={vendors}
                    onError={setError}
                    onSaved={() => {
                      setError(null);
                      void queryClient.invalidateQueries({
                        queryKey: ['workOrders', projectId],
                      });
                    }}
                  />
                )}
              </div>
            </section>
          ) : (
            !orders.isLoading && (
              <p className="text-sm text-gray-600">
                {WORK_ORDER_COPY.pickPrompt}
              </p>
            )
          )}
        </div>
      </div>

      {orphanBills.length > 0 && (
        <section className="space-y-2 border-t border-gray-200 pt-4">
          <h2 className="text-base font-semibold text-gray-900">
            {WORK_ORDER_COPY.orphanBillsHeading}
          </h2>
          <p className="text-sm text-gray-600">
            {WORK_ORDER_COPY.orphanBillsHint}
          </p>
          <ul className="space-y-2">
            {orphanBills.map((bill) => (
              <li
                key={bill.id}
                className="rounded border border-gray-200 p-3 text-sm"
              >
                <BillSummary bill={bill} />
                {/* No actions: these are measured against no award, so there is nothing to revise
                    them against. Reading one is the whole of what can be done with it. */}
                <RaBillView bill={bill} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Every active vendor, for the subcontractor picker.
 *
 * One hook so the raise form and the settings form share a single fetch — TanStack keys it, so the
 * second caller reads the cache rather than the network.
 *
 * `pageSize` matches `contractor-modal.tsx`'s existing 200. A register larger than that is
 * **reported, not silently truncated**: `truncated` carries the count so the picker can say the one
 * you want may not be in the list, which is the difference between a short list and a wrong one.
 */
function useVendorOptions() {
  const query = useQuery({
    queryKey: ['vendors', 'workOrderPicker'],
    queryFn: () => getVendors({ active: true, pageSize: 200 }),
  });
  const items = query.data?.items ?? [];
  return {
    isLoading: query.isLoading,
    options: items.map<SearchableOption>((vendor) => ({
      id: vendor.id,
      label: vendor.name,
      sublabel: vendor.city ?? undefined,
      note: vendor.code,
    })),
    byId: new Map(items.map((vendor) => [vendor.id, vendor.name])),
    truncated:
      query.data && query.data.total > items.length
        ? WORK_ORDER_COPY.vendorTruncated(items.length, query.data.total)
        : null,
  };
}

type VendorOptions = ReturnType<typeof useVendorOptions>;

/** The subcontractor field, shared by raising and correcting. */
function VendorPicker({
  vendors,
  value,
  onChange,
}: {
  vendors: VendorOptions;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {WORK_ORDER_COPY.vendorLabel}
      </span>
      {/* A searchable list rather than a native select, for the reason the BOQ picker is one: a
          register of a few hundred vendors cannot be walked by first letter. */}
      <SearchableSelect
        value={value}
        onChange={onChange}
        options={vendors.options}
        emptyLabel={WORK_ORDER_COPY.vendorNone}
        placeholder={
          vendors.isLoading
            ? WORK_ORDER_COPY.vendorLoading
            : WORK_ORDER_COPY.vendorLabel
        }
        disabled={vendors.isLoading}
      />
      <p className="mt-1 text-xs text-gray-500">{WORK_ORDER_COPY.vendorHint}</p>
      {vendors.truncated && (
        <p className="mt-1 text-xs text-amber-900">{vendors.truncated}</p>
      )}
    </div>
  );
}

/**
 * Raising a work order (027).
 *
 * The subcontractor is asked for **here**, at the one moment somebody knows it. `partnerId` has
 * been on the API since 018 and no screen ever sent it, so every work order in the product reads as
 * an anonymous contract — and "who is this with" is the first question asked of one.
 *
 * It stays optional: a work order is sometimes raised before the vendor is settled, and refusing
 * that would push the record into a spreadsheet until it was.
 */
function RaiseForm({
  projectId,
  vendors,
  onCancel,
  onRaised,
  onError,
}: {
  projectId: string;
  vendors: VendorOptions;
  onCancel: () => void;
  onRaised: (order: WorkOrder) => void;
  onError: (message: string | null) => void;
}) {
  const [workDetail, setWorkDetail] = useState('');
  const [retention, setRetention] = useState('');
  const [partnerId, setPartnerId] = useState('');

  const raise = useMutation({
    mutationFn: () =>
      createWorkOrder({
        projectId,
        workDetail: workDetail.trim(),
        // Percent in, fraction out. The server's bound is [0,1] and `bill-sheet.tsx` divides the
        // same way — one convention, converted on the one side that collects a percent.
        retentionPercent: retention ? Number(retention) / 100 : undefined,
        ...(partnerId ? { partnerId } : {}),
        status: 'active',
      }),
    onSuccess: onRaised,
    onError: (err) =>
      onError(
        err instanceof ApiError ? err.message : WORK_ORDER_COPY.raiseFailed,
      ),
  });

  return (
    <section className="space-y-4 rounded border border-gray-200 p-4">
      <h2 className="text-base font-semibold text-gray-900">
        {WORK_ORDER_COPY.newHeading}
      </h2>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <TextField
          id="wo-new-detail"
          label={WORK_ORDER_COPY.detailLabel}
          value={workDetail}
          onChange={(event) => setWorkDetail(event.target.value)}
        />
        <VendorPicker
          vendors={vendors}
          value={partnerId}
          onChange={setPartnerId}
        />
        <TextField
          id="wo-new-retention"
          type="number"
          step="0.01"
          min="0"
          max="100"
          label={WORK_ORDER_COPY.retentionLabel}
          hint={WORK_ORDER_COPY.retentionHint}
          value={retention}
          onChange={(event) => setRetention(event.target.value)}
        />
        <div>
          {/* The retention hint runs to three lines, so an `items-end` row would drop these
              buttons to the bottom of it, a long way under the fields they belong to. */}
          <FieldLabelSpacer />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={!workDetail.trim() || raise.isPending}
              onClick={() => {
                onError(null);
                raise.mutate();
              }}
            >
              {raise.isPending
                ? WORK_ORDER_COPY.raising
                : WORK_ORDER_COPY.raise}
            </Button>
            <SecondaryButton type="button" onClick={onCancel}>
              {WORK_ORDER_COPY.raiseCancel}
            </SecondaryButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The award tab: a thin frame over {@link AwardEditor}.
 *
 * The editing itself moved out when the award stopped being a paste box — see `award-editor.tsx`
 * for why there are three ways to enter a line and why the subcontractor's rate is never prefilled.
 * What stays here is the one fact the editor cannot know on its own: whether a bill exists, which
 * is what the server refuses a replacement on.
 */
function AwardTab({
  projectId,
  order,
  onSaved,
  onError,
}: {
  projectId: string;
  order: WorkOrder;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      {order.awardLineCount > 0 && (
        <p className="text-sm text-gray-900">
          {WORK_ORDER_COPY.awardCaptured(order.awardLineCount)}
        </p>
      )}
      <AwardEditor
        projectId={projectId}
        workOrderId={order.id}
        locked={order.billCount > 0}
        onSaved={onSaved}
        onError={onError}
      />
    </div>
  );
}

/**
 * The bills measured against one work order, and the sheet that composes the next one.
 *
 * ## Revising goes through the sheet, never inline (FR-009)
 *
 * Opening a submitted or certified bill in the sheet shows the warning **before** anything can be
 * edited, because the warning is the requirement. This tab's job is to put the bill into the sheet
 * rather than offering an inline edit that would bypass it.
 */
function BillsTab({
  projectId,
  order,
  bills,
  revising,
  onRevise,
  onCaptureAward,
  onError,
}: {
  projectId: string;
  order: WorkOrder;
  bills: RaBill[];
  revising: RaBill | null;
  onRevise: (bill: RaBill | null) => void;
  onCaptureAward: () => void;
  onError: (message: string | null) => void;
}) {
  const queryClient = useQueryClient();
  /** Which bills are expanded. A set, because reading two side by side is how they get compared. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  const submit = useMutation({
    mutationFn: (id: string) => submitRaBill(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['raBills', projectId] }),
    onError: (err) =>
      onError(
        err instanceof ApiError ? err.message : BILLING_COPY.submitFailed,
      ),
  });

  return (
    <div className="space-y-4">
      {order.awardLineCount === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-900">
            {WORK_ORDER_COPY.awardMissing}
          </p>
          <SecondaryButton type="button" onClick={onCaptureAward}>
            {WORK_ORDER_COPY.awardHeading}
          </SecondaryButton>
        </div>
      ) : (
        <RaBillSheet
          projectId={projectId}
          workOrderId={order.id}
          revising={revising ?? undefined}
          key={`${order.id}:${revising?.id ?? 'new'}`}
        />
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {BILLING_COPY.billsHeading}
        </h3>
        {bills.length === 0 ? (
          <p className="text-sm text-gray-600">{BILLING_COPY.billsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {bills.map((bill) => (
              <li
                key={bill.id}
                className="rounded border border-gray-200 p-3 text-sm"
              >
                <BillSummary bill={bill} />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <SecondaryButton
                    type="button"
                    aria-expanded={opened.has(bill.id)}
                    onClick={() =>
                      setOpened((current) => {
                        const next = new Set(current);
                        if (!next.delete(bill.id)) next.add(bill.id);
                        return next;
                      })
                    }
                  >
                    {opened.has(bill.id)
                      ? BILLING_COPY.hideBill
                      : BILLING_COPY.viewBill}
                  </SecondaryButton>
                  {bill.status === 'draft' && (
                    <RowAction
                      type="button"
                      className="min-h-11 justify-center sm:min-h-0"
                      onClick={() => {
                        onError(null);
                        submit.mutate(bill.id);
                      }}
                    >
                      {BILLING_COPY.submit}
                    </RowAction>
                  )}
                  {/* A draft is edited; a bill somebody has acted on is revised. Saying "revise"
                      over a draft promised a formality that does not apply to it. */}
                  <SecondaryButton type="button" onClick={() => onRevise(bill)}>
                    {bill.status === 'draft'
                      ? BILLING_COPY.editHeading
                      : BILLING_COPY.reviseHeading}
                  </SecondaryButton>
                </div>
                {opened.has(bill.id) && <RaBillView bill={bill} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** One bill's identity and its two figures. Shared by the tab and the unattached list. */
function BillSummary({ bill }: { bill: RaBill }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="font-medium text-gray-900">
        {bill.billNumber}
        <span className="ml-2 text-xs text-gray-500">
          {dateLabel(bill.billingDate)} ·{' '}
          {BILLING_COPY.statusLabels[bill.status] ?? bill.status}
        </span>
      </span>
      <span className="tabular-nums text-gray-900">
        {`${BILLING_COPY.gross} ${rupees(bill.grossAmount)} · ${BILLING_COPY.netPayable} ${rupees(bill.netPayable)}`}
      </span>
    </div>
  );
}

/**
 * Correcting the record on one work order (025 FR-032, extended by 027).
 *
 * The detail and the retention term could be set once and never corrected — a typo in either meant
 * living with it, or a second work order beside the wrong one. The subcontractor joins them here
 * for the work orders raised before there was anywhere to record it.
 *
 * The fields are seeded from the order and the panel is keyed on its id, so switching contracts in
 * the list reloads the defaults rather than leaving the previous order's values in the inputs.
 */
function SettingsTab({
  order,
  vendors,
  onSaved,
  onError,
}: {
  order: WorkOrder;
  vendors: VendorOptions;
  onSaved: () => void;
  onError: (message: string | null) => void;
}) {
  const [workDetail, setWorkDetail] = useState(order.workDetail);
  const [retention, setRetention] = useState(
    (order.retentionPercent * 100).toFixed(2),
  );
  const [partnerId, setPartnerId] = useState(order.partnerId ?? '');
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      updateWorkOrder(order.id, {
        ...(workDetail.trim() ? { workDetail: workDetail.trim() } : {}),
        // Percent in, fraction out — the same conversion the raise form makes, and the one the
        // server's bound of 1 is expressed in.
        ...(retention.trim()
          ? { retentionPercent: Number(retention) / 100 }
          : {}),
        ...(partnerId ? { partnerId } : {}),
      }),
    onSuccess: () => {
      setSaved(true);
      onSaved();
    },
    onError: (err) => {
      setSaved(false);
      onError(err instanceof ApiError ? err.message : String(err));
    },
  });

  return (
    <form
      className="grid items-start gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onError(null);
        save.mutate();
      }}
    >
      <TextField
        id="wo-edit-detail"
        label={WORK_ORDER_COPY.detailField}
        value={workDetail}
        onChange={(event) => setWorkDetail(event.target.value)}
      />
      <VendorPicker
        vendors={vendors}
        value={partnerId}
        onChange={setPartnerId}
      />
      <TextField
        id="wo-edit-retention"
        type="number"
        step="0.01"
        min="0"
        max="100"
        label={WORK_ORDER_COPY.retentionLabel}
        hint={WORK_ORDER_COPY.retentionHint}
        value={retention}
        onChange={(event) => setRetention(event.target.value)}
      />
      <div>
        <FieldLabelSpacer />
        <Button type="submit" disabled={save.isPending}>
          {WORK_ORDER_COPY.settingsSave}
        </Button>
        {saved && !save.isPending && (
          <p className="mt-1 text-xs text-green-700" role="status">
            {WORK_ORDER_COPY.settingsSaved}
          </p>
        )}
      </div>
    </form>
  );
}
