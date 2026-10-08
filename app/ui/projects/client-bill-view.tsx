'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';

import {
  certifyClientBill,
  submitClientBill,
  type ClientBill,
  type ClientBillLine,
} from '@/app/lib/api/billing';
import { ApiError } from '@/app/lib/api/client';
import { BILLING_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';

/**
 * One client bill, read, with the two acts it still accepts (027).
 *
 * ## Reading came first, and did not exist
 *
 * The billing page opened on the composing sheet — 231 editable BOQ rows — with the bills raised
 * buried beneath it. There was no way to look at a bill: its lines lived only in the sheet that
 * creates the next one, and the history table showed five totals and no detail. "What did we
 * actually bill them in RA-02" had no answer on this screen.
 *
 * ## Rendered at the rates it was billed at (FR-006)
 *
 * Every figure here comes from the bill, never from the BOQ. A rate corrected after a bill was sent
 * must not restate it — the bill is a document somebody received, and re-pricing it from a live
 * rate table would make every historical bill change shape each time a rate is fixed.
 *
 * ## Certification is a section, not a modal
 *
 * FR-005 keeps the billed and the certified amount side by side, because the variance between them
 * is what a project manager chases and it must not be reachable only by noticing that two numbers
 * differ. The field is pre-filled with the billed figure: the client certifying in full is the
 * common case, and a blank field would make the common case the most typing.
 *
 * **Not certified yet is said in words.** A dash would read as a shortfall of unknown size; nobody
 * has answered is a different fact from answered short.
 */
export default function ClientBillView({
  projectId,
  bill,
}: {
  projectId: string;
  bill: ClientBill;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [certifying, setCertifying] = useState(false);
  const [certifiedAmount, setCertifiedAmount] = useState('');
  const [showAllLines, setShowAllLines] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['clientBills', projectId] });
    // The BOQ's cumulative column moves when a bill leaves draft, so the sheet has to be told.
    // Invalidating rather than patching: the server decides what is now billed to date.
    void queryClient.invalidateQueries({ queryKey: ['billableBoq', projectId] });
  };

  const submit = useMutation({
    mutationFn: () => submitClientBill(bill.id),
    onSuccess: refresh,
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : BILLING_COPY.submitFailed,
      ),
  });

  const certify = useMutation({
    mutationFn: () => certifyClientBill(bill.id, Number(certifiedAmount)),
    onSuccess: () => {
      setCertifying(false);
      setCertifiedAmount('');
      refresh();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : BILLING_COPY.submitFailed,
      ),
  });

  const shortfall =
    bill.certificationVariance !== null && bill.certificationVariance !== 0;

  /**
   * What this bill actually billed.
   *
   * `!== 0` rather than `> 0`, so a negative correction — a line reduced on a revision — is still
   * a line this bill acted on and is still shown.
   */
  const billed = bill.lines.filter((line) => Number(line.quantity) !== 0);
  const hidden = bill.lines.length - billed.length;
  const lines = showAllLines ? bill.lines : billed;

  /**
   * The lines under the headings they belong to (027).
   *
   * Reported on a real bill: two rows read "12.01 Suspended floors, roofs, landings …" and "12.02
   * Columns, pillars, posts and struts etc." — a place and no work. The work is in the heading,
   * *"centering and shuttering … and removal of formwork"*, and a client reading ₹340 a square metre
   * could not tell what had been done to those floors.
   *
   * Grouped rather than repeated on every row because the heading is a sentence, and printing it
   * twice beside two one-line qualifiers is how a bill stops being readable.
   *
   * Order comes from the server — `boqNo`, numerically — and first appearance preserves it, so the
   * sections read in schedule order without a second sort that could disagree with the first.
   */
  const sections = useMemo(() => {
    const ordered: { id: string; name: string; lines: ClientBillLine[] }[] = [];
    const byId = new Map<string, (typeof ordered)[number]>();
    for (const line of lines) {
      let section = byId.get(line.groupId);
      if (!section) {
        section = { id: line.groupId, name: line.groupName, lines: [] };
        byId.set(line.groupId, section);
        ordered.push(section);
      }
      section.lines.push(line);
    }
    return ordered;
  }, [lines]);

  return (
    <section className="space-y-4">
      <header className="space-y-1 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold text-gray-900">
            {bill.billNumber}
          </h2>
          <StatusBadge
            status={bill.status}
            label={BILLING_COPY.statusLabels[bill.status] ?? bill.status}
          />
        </div>
        <p className="text-sm text-gray-600">{dateLabel(bill.billingDate)}</p>
        {bill.description && (
          <p className="text-sm text-gray-900">{bill.description}</p>
        )}
        {bill.status === 'draft' && (
          <p className="text-sm text-gray-600">{BILLING_COPY.draftNotSent}</p>
        )}
      </header>

      <FormError message={error} />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {BILLING_COPY.billLinesHeading}
        </h3>
        {lines.length === 0 ? (
          <p className="text-sm text-gray-600">
            {BILLING_COPY.nothingBilledOnThisBill}
          </p>
        ) : (
        /* Scrolls inside itself, so a forty-word BOQ description never widens the page. */
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-2 py-2">{BILLING_COPY.columns.boqNo}</th>
                <th className="px-2 py-2">{BILLING_COPY.columns.task}</th>
                <th className="px-2 py-2">{BILLING_COPY.columns.unit}</th>
                <th className="px-2 py-2 text-right">
                  {BILLING_COPY.columns.quantity}
                </th>
                <th className="px-2 py-2 text-right">
                  {BILLING_COPY.columns.rate}
                </th>
                <th className="px-2 py-2 text-right">
                  {BILLING_COPY.columns.amount}
                </th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <Fragment key={section.id}>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    {/*
                      Spans the row. A heading with empty cells under Quantity and Rate reads as a
                      line billed at nothing, which is a different claim from a heading.
                    */}
                    <th
                      scope="colgroup"
                      colSpan={6}
                      className="px-2 py-1.5 text-left text-sm font-semibold text-gray-900"
                    >
                      {section.name}
                    </th>
                  </tr>
                  {section.lines.map((line) => (
                    <tr key={line.id} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 tabular-nums text-gray-600">
                        {line.boqNo}
                      </td>
                      <td className="px-2 py-1.5 text-gray-900">
                        {line.taskName}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600">{line.unit}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                        {line.quantity}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">
                        {/* The rate **as billed**, frozen at composition. Never today's BOQ rate. */}
                        {rupees(line.rate)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                        {rupees(line.amount)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        )}
        {hidden > 0 && (
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-xs text-gray-500">
              {BILLING_COPY.linesHidden(hidden, billed.length)}
            </p>
            <button
              type="button"
              onClick={() => setShowAllLines((current) => !current)}
              className="text-xs font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              {showAllLines
                ? BILLING_COPY.showBilledLines
                : BILLING_COPY.showAllLines}
            </button>
          </div>
        )}
        <p className="text-xs text-gray-500">
          {BILLING_COPY.historicalRatesNote}
        </p>
      </section>

      <dl className="max-w-sm space-y-1 rounded border border-gray-200 p-3 text-sm">
        <Figure label={BILLING_COPY.gross} value={bill.grossAmount} />
        <Figure
          label={BILLING_COPY.retention}
          value={bill.retentionAmount}
          muted
        />
        <Figure label={BILLING_COPY.net} value={bill.netAmount} strong />
      </dl>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {BILLING_COPY.certificationHeading}
        </h3>

        {bill.certifiedAmount === null ? (
          <p className="text-sm text-gray-600">
            {BILLING_COPY.notCertifiedYet}
          </p>
        ) : (
          <dl className="max-w-sm space-y-1 rounded border border-gray-200 p-3 text-sm">
            <Figure label={BILLING_COPY.billedLabel} value={bill.grossAmount} />
            <Figure
              label={BILLING_COPY.certified}
              value={bill.certifiedAmount}
              strong
            />
            {shortfall ? (
              <p className="pt-1 text-sm font-medium text-amber-900">
                {BILLING_COPY.certifiedShort(
                  rupees(bill.certificationVariance ?? 0),
                )}
              </p>
            ) : (
              <p className="pt-1 text-xs text-gray-500">
                {BILLING_COPY.certifiedMatched}
              </p>
            )}
          </dl>
        )}

        {certifying && (
          <div className="max-w-sm space-y-2">
            <TextField
              id={`certified-${bill.id}`}
              type="number"
              step="0.01"
              min="0"
              label={BILLING_COPY.certifyLabel}
              hint={BILLING_COPY.certifyHint}
              value={certifiedAmount}
              onChange={(event) => setCertifiedAmount(event.target.value)}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <SecondaryButton
                type="button"
                onClick={() => setCertifying(false)}
              >
                {BILLING_COPY.cancel}
              </SecondaryButton>
              <Button
                type="button"
                disabled={certify.isPending || certifiedAmount === ''}
                onClick={() => {
                  setError(null);
                  certify.mutate();
                }}
              >
                {certify.isPending
                  ? BILLING_COPY.certifySaving
                  : BILLING_COPY.certifySave}
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {bill.status === 'draft' && (
          <Button
            type="button"
            disabled={submit.isPending}
            onClick={() => {
              setError(null);
              submit.mutate();
            }}
          >
            {submit.isPending ? BILLING_COPY.submitting : BILLING_COPY.submit}
          </Button>
        )}
        {/* Only once it has gone out: certifying a draft would record the client's answer to a
            bill they were never sent. */}
        {bill.status !== 'draft' &&
          bill.certifiedAmount === null &&
          !certifying && (
            <SecondaryButton
              type="button"
              onClick={() => {
                setCertifying(true);
                setCertifiedAmount(String(bill.grossAmount));
              }}
            >
              {BILLING_COPY.certifyOpen}
            </SecondaryButton>
          )}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: string;
  /** Null where the figure is not yet settled — see `BILLING_COPY.netNotYetSettled`. */
  value: number | null;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={muted ? 'text-gray-600' : 'text-gray-900'}>{label}</dt>
      <dd
        className={
          strong
            ? 'font-semibold tabular-nums text-gray-900'
            : 'tabular-nums text-gray-900'
        }
      >
        {value === null ? (
          <span className="text-sm font-normal text-gray-500">
            {BILLING_COPY.netNotYetSettled}
          </span>
        ) : (
          rupees(value)
        )}
      </dd>
    </div>
  );
}
