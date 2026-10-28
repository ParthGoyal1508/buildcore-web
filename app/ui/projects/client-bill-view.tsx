'use client';

import Link from 'next/link';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Fragment, useMemo, useState, type ReactNode } from 'react';

import { BILL_STATUS_LABELS } from '@/app/lib/api/bill-packages';
import {
  certifyClientBill,
  downloadCertificate,
  submitClientBill,
  type ClientBill,
  type ClientBillLine,
} from '@/app/lib/api/billing';
import { ApiError } from '@/app/lib/api/client';
import { BILLING_COPY, ROUTES } from '@/app/lib/constants';
import { openStoredFile } from '@/app/lib/download-file';
import { isViewableFile, useFileViewer } from '@/app/ui/pdf-viewer';
import { percentLabel } from '@/app/lib/bill-totals';
import { dateLabel, quantity3, rupees, unitRate } from '@/app/lib/format';
import { Button, TextButton } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  projectErrorMessage,
  useProjectLock,
} from '@/app/ui/projects/project-lock-context';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import { TABLE } from '@/app/ui/table';
import ClientBillReceipts from '@/app/ui/projects/client-bill-receipts';

/**
 * The shared table look at the bill's density (2026-10-15): the schedule reads like the printed
 * bill, and px-4 py-3 spreads it over twice the scroll. `!` because clsx does not drop TABLE's
 * own padding.
 */
const DENSE_TH = clsx(TABLE.th, '!px-3 !py-2');
const DENSE_TD = clsx(TABLE.td, '!px-3 !py-2');
/** A certified quantity as typed: digits, at most one point, at most three decimals. */
const CERTIFIED_QTY_PATTERN = /^\d*(\.\d{0,3})?$/;

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
  const { isLocked } = useProjectLock();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [certifying, setCertifying] = useState(false);
  const [certifiedAmount, setCertifiedAmount] = useState('');
  /**
   * Per-line certified quantities, keyed by bill line (2026-10-11).
   *
   * A line absent from this map is a line the client did not mention, and the server
   * reads that as "billed quantity stands". Blank is therefore meaningfully different
   * from `0`, which returns the whole quantity to the schedule — so the entries are
   * strings and an empty one is dropped before sending rather than coerced to zero.
   */
  const [certifiedQtys, setCertifiedQtys] = useState<Record<string, string>>(
    {},
  );
  /**
   * Kept exactly as typed (036 follow-up, as I14 did for the RA sheet): a `type="number"` field
   * hands back `''` for "10." mid-typing, and some locales' keyboards cannot type the point at all.
   * Digits, one point and at most three decimals — the API stores 3dp.
   */
  const qtyInvalid = (raw: string | undefined) => {
    const value = raw?.trim() ?? '';
    // A lone "." matches the pattern but is not a number.
    return (
      value !== '' && (!CERTIFIED_QTY_PATTERN.test(value) || value === '.')
    );
  };
  const anyQtyInvalid = Object.values(certifiedQtys).some(qtyInvalid);
  /** Line by line, or a single figure. Line by line is what frees uncertified scope. */
  const [perLine, setPerLine] = useState(true);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [showAllLines, setShowAllLines] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries({
      queryKey: ['clientBills', projectId],
    });
    // The BOQ's cumulative column moves when a bill leaves draft, so the sheet has to be told.
    // Invalidating rather than patching: the server decides what is now billed to date.
    void queryClient.invalidateQueries({
      queryKey: ['billableBoq', projectId],
    });
  };

  const submit = useMutation({
    mutationFn: () => submitClientBill(bill.id),
    onSuccess: () => {
      toast.success(`${bill.billNumber} was submitted.`);
      refresh();
    },
    onError: (err) => {
      // A second submit (double click, second tab) is refused 409 BILL_NOT_DRAFT: the bill did go,
      // so say so and refetch rather than report a failure (036 Wave 3, 2026-10-17).
      if (err instanceof ApiError && err.code === 'BILL_NOT_DRAFT') {
        toast.info('This bill has already been submitted.');
        refresh();
        return;
      }
      // A 423 reads as the lock, not "could not be submitted".
      setError(projectErrorMessage(err, BILLING_COPY.submitFailed));
    },
  });

  const certify = useMutation({
    mutationFn: () =>
      certifyClientBill(bill.id, {
        ...(perLine
          ? {
              lines: Object.entries(certifiedQtys)
                // Blank means "not said" and must not reach the server as a zero.
                .filter(([, value]) => value.trim() !== '')
                .map(([lineId, value]) => ({
                  lineId,
                  certifiedQty: Number(value.trim()),
                })),
            }
          : { certifiedAmount: Number(certifiedAmount) }),
        ...(certificate ? { certificate } : {}),
      }),
    onSuccess: () => {
      setCertifying(false);
      setCertifiedAmount('');
      setCertifiedQtys({});
      setCertificate(null);
      toast.success('The certification was recorded.');
      refresh();
    },
    onError: (err) =>
      setError(projectErrorMessage(err, BILLING_COPY.submitFailed)),
  });

  // A PDF or scanned certificate opens in the page's own viewer (2026-10-14) rather than a new tab
  // — one opened after a fetch is one most browsers block. Anything else is still saved.
  const { view, viewer } = useFileViewer();
  const openCertificate = async () => {
    setError(null);
    const certificate = bill.certificate;
    if (
      certificate &&
      isViewableFile(certificate.mimeType, certificate.fileName)
    ) {
      void view({
        title: certificate.fileName,
        fileName: certificate.fileName,
        load: () => downloadCertificate(bill.id),
      });
      return;
    }
    try {
      const file = await downloadCertificate(bill.id);
      openStoredFile(file, bill.certificate?.fileName ?? 'certificate');
    } catch {
      setError(BILLING_COPY.certifyCopyFailed);
    }
  };

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

  /**
   * Whether this bill was priced away from the schedule, and by how much (2026-10-13).
   *
   * Everything the quote adds to this screen is behind it. At par there is one rate, one total and
   * nothing to explain — and a second rate column repeating the first, under a heading that implies
   * a difference, is worse than no column at all.
   */
  const quoted = bill.quotedPercentage !== 0;
  const quotePercent = `${percentLabel(Math.abs(bill.quotedPercentage))} ${
    bill.quotedPercentage < 0 ? 'below' : 'above'
  }`;

  return (
    <section className="space-y-4">
      <header className="space-y-1 border-b border-gray-200 pb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold text-gray-900">
            {bill.billNumber}
          </h2>
          {/* The package's status where there is one — it is where this bill actually stands. */}
          <StatusBadge
            status={bill.package ? bill.package.status : bill.status}
            label={
              bill.package
                ? BILL_STATUS_LABELS[bill.package.status]
                : (BILLING_COPY.statusLabels[bill.status] ?? bill.status)
            }
          />
        </div>
        <p className="text-sm text-gray-600">{dateLabel(bill.billingDate)}</p>
        {bill.description && (
          <p className="text-sm text-gray-900">{bill.description}</p>
        )}
        {!bill.package && bill.status === 'draft' && (
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
          <div className={TABLE.wrap}>
            <table className={clsx(TABLE.table, 'w-full min-w-[44rem]')}>
              <thead className={TABLE.thead}>
                <tr>
                  <th className={DENSE_TH}>{BILLING_COPY.columns.boqNo}</th>
                  <th className={DENSE_TH}>{BILLING_COPY.columns.task}</th>
                  <th className={DENSE_TH}>{BILLING_COPY.columns.unit}</th>
                  <th className={clsx(DENSE_TH, 'text-right')}>
                    {BILLING_COPY.columns.quantity}
                  </th>
                  <th className={clsx(DENSE_TH, 'text-right')}>
                    {quoted
                      ? BILLING_COPY.columns.boqRate
                      : BILLING_COPY.columns.rate}
                  </th>
                  {quoted && (
                    <th className={clsx(DENSE_TH, 'text-right')}>
                      {BILLING_COPY.columns.quotedRate}
                    </th>
                  )}
                  <th className={clsx(DENSE_TH, 'text-right')}>
                    {BILLING_COPY.columns.amount}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <Fragment key={section.id}>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {/*
                      Spans the row. A heading with empty cells under Quantity and Rate reads as a
                      line billed at nothing, which is a different claim from a heading.
                    */}
                      <th
                        scope="colgroup"
                        colSpan={quoted ? 7 : 6}
                        className="px-3 py-1.5 text-left text-sm font-semibold text-gray-900"
                      >
                        {section.name}
                      </th>
                    </tr>
                    {section.lines.map((line) => (
                      <tr key={line.id} className={TABLE.row}>
                        <td
                          className={clsx(
                            DENSE_TD,
                            'tabular-nums text-gray-600',
                          )}
                        >
                          {line.boqNo}
                        </td>
                        <td className={clsx(DENSE_TD, 'text-gray-900')}>
                          {line.taskName}
                        </td>
                        <td className={clsx(DENSE_TD, 'text-gray-600')}>
                          {line.unit}
                        </td>
                        <td
                          className={clsx(
                            DENSE_TD,
                            TABLE.numeric,
                            'text-gray-900',
                          )}
                        >
                          {quantity3(Number(line.quantity))}
                        </td>
                        <td
                          className={clsx(
                            DENSE_TD,
                            TABLE.numeric,
                            'text-gray-600',
                          )}
                        >
                          {/* The schedule's rate, frozen at composition. Never today's BOQ rate. */}
                          {unitRate(line.rate)}
                        </td>
                        {quoted && (
                          <td
                            className={clsx(
                              DENSE_TD,
                              TABLE.numeric,
                              'text-gray-600',
                            )}
                          >
                            {/*
                            What the quantity was actually priced at, and to four decimals where
                            the quote needs them: at two it stops multiplying out to the amount in
                            the next column, which is the whole reason this one is here.
                          */}
                            {unitRate(line.quotedRate)}
                          </td>
                        )}
                        <td
                          className={clsx(
                            DENSE_TD,
                            TABLE.numeric,
                            'text-gray-900',
                          )}
                        >
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
            <TextButton
              size="xs"
              className="underline"
              onClick={() => setShowAllLines((current) => !current)}
            >
              {showAllLines
                ? BILLING_COPY.showBilledLines
                : BILLING_COPY.showAllLines}
            </TextButton>
          </div>
        )}
        {quoted && (
          <p className="text-xs text-gray-500">
            {BILLING_COPY.quotedRateNote(quotePercent)}
          </p>
        )}
        <p className="text-xs text-gray-500">
          {BILLING_COPY.historicalRatesNote}
        </p>
      </section>

      {/*
        **Three rows only where three rows are true.**

        A bill settled through a package has its net decided by the abstract: tax added to the work,
        then recoveries, retention and TDS taken off. Gross, Retention and Net alone made that look
        like a subtraction — and it is not one, which is why a bill reading ₹50,837.21 gross and
        ₹56,937.68 net was reported as wrong when every figure on it was right.

        A bill composed on the sheet carries no tax and no recoveries. There the three rows say
        everything there is to say, and printing fourteen mostly-zero rows would imply a complexity
        the bill does not have.
      */}
      {bill.settlement ? (
        <Settlement
          settlement={bill.settlement}
          lead={<QuoteRows bill={bill} />}
        />
      ) : (
        <dl className="max-w-sm space-y-1 rounded border border-gray-200 p-3 text-sm">
          <QuoteRows bill={bill} />
          <Figure label={BILLING_COPY.gross} value={bill.grossAmount} />
          <Figure
            label={BILLING_COPY.retention}
            value={bill.retentionAmount}
            muted
          />
          <Figure label={BILLING_COPY.net} value={bill.netAmount} strong />
        </dl>
      )}

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

        {viewer}
        {bill.certificate && (
          <p className="text-sm">
            <TextButton onClick={() => void openCertificate()}>
              {BILLING_COPY.certifyCopyOpen} — {bill.certificate.fileName}
            </TextButton>
          </p>
        )}

        {certifying && (
          <div className="space-y-3">
            <TextButton onClick={() => setPerLine((on) => !on)}>
              {perLine
                ? BILLING_COPY.certifyAmountOnly
                : BILLING_COPY.certifyLinesInstead}
            </TextButton>

            {perLine ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">
                  {BILLING_COPY.certifyPerLineHint}
                </p>
                <div className={TABLE.wrap}>
                  <table className={TABLE.table}>
                    <thead className={TABLE.thead}>
                      <tr>
                        <th className={DENSE_TH}>BOQ</th>
                        <th className={clsx(DENSE_TH, 'text-right')}>
                          {BILLING_COPY.certifyBilledQty}
                        </th>
                        <th className={clsx(DENSE_TH, 'text-right')}>
                          {BILLING_COPY.certifyCertifiedQty}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {billed.map((line) => (
                        <tr key={line.id} className={TABLE.row}>
                          <td className={DENSE_TD}>
                            {line.boqNo}
                            <span className="block text-xs text-gray-500">
                              {line.taskName}
                            </span>
                          </td>
                          <td className={clsx(DENSE_TD, TABLE.numeric)}>
                            {quantity3(Number(line.quantity))} {line.unit}
                          </td>
                          <td className={clsx(DENSE_TD, 'text-right')}>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="\d*(\.\d{0,3})?"
                              autoComplete="off"
                              aria-invalid={
                                qtyInvalid(certifiedQtys[line.id]) || undefined
                              }
                              title={
                                qtyInvalid(certifiedQtys[line.id])
                                  ? 'A quantity, with up to three decimals — for example 10.05'
                                  : undefined
                              }
                              aria-label={`${BILLING_COPY.certifyCertifiedQty} — ${line.boqNo}`}
                              // Blank, never pre-filled with the billed quantity: a
                              // prefilled field is one somebody accepts, and accepting
                              // it silently certifies in full.
                              placeholder={String(line.certifiedQty ?? '')}
                              value={certifiedQtys[line.id] ?? ''}
                              onChange={(event) =>
                                setCertifiedQtys((current) => ({
                                  ...current,
                                  [line.id]: event.target.value,
                                }))
                              }
                              className={clsx(
                                'w-28 rounded border px-2 py-1 text-right tabular-nums',
                                qtyInvalid(certifiedQtys[line.id])
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-300',
                              )}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="max-w-sm">
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
              </div>
            )}

            <div className="max-w-sm">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor={`certificate-${bill.id}`}
              >
                {BILLING_COPY.certifyCopyLabel}
              </label>
              <input
                id={`certificate-${bill.id}`}
                type="file"
                accept=".pdf,.xls,.xlsx,application/pdf"
                className="mt-1 text-sm"
                onChange={(event) =>
                  setCertificate(event.target.files?.[0] ?? null)
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                {BILLING_COPY.certifyCopyHint}
              </p>
            </div>

            <div className="flex max-w-sm flex-col-reverse gap-2 sm:flex-row">
              <SecondaryButton
                type="button"
                onClick={() => setCertifying(false)}
              >
                {BILLING_COPY.cancel}
              </SecondaryButton>
              <Button
                type="button"
                loading={certify.isPending}
                disabled={
                  // Line by line needs at least one figure; a single amount needs the
                  // amount. Neither path should post an empty certification.
                  (perLine
                    ? anyQtyInvalid ||
                      !Object.values(certifiedQtys).some(
                        (value) => value.trim() !== '',
                      )
                    : certifiedAmount === '')
                }
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

      {bill.package ? (
        // One bill, one approval (2026-10-14). Approval, issue and certification — with the
        // client's certificate — happen on the bill's own page.
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={ROUTES.projectsBillPackage(projectId, bill.package.id)}
            className="inline-flex min-h-11 items-center rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:min-h-0"
          >
            Open {bill.package.label} — approve, issue and certify
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Write controls are absent on a locked project (036 Wave 3): the server refuses 423. */}
          {bill.status === 'draft' && !isLocked && (
            <Button
              type="button"
              loading={submit.isPending}
              onClick={async () => {
                if (
                  !(await confirmDialog({
                    title: 'Submit this bill?',
                    message: `${bill.billNumber} is sent to the client. It cannot be edited as a draft afterwards.`,
                    confirmLabel: 'Submit',
                  }))
                ) {
                  return;
                }
                setError(null);
                submit.mutate();
              }}
            >
              {submit.isPending ? BILLING_COPY.submitting : BILLING_COPY.submit}
            </Button>
          )}
          {/* Only once it has gone out: certifying a draft would record the client's answer to a
            bill they were never sent. */}
          {/* **Also once it is certified (2026-10-11)**: re-certifying is how a
            certification is corrected, which is what was asked for. The server accepts
            an already-certified bill and replaces what it holds. */}
          {bill.status !== 'draft' && !certifying && !isLocked && (
            <SecondaryButton
              type="button"
              onClick={() => {
                setCertifying(true);
                setCertifiedAmount(String(bill.grossAmount));
              }}
            >
              {bill.certifiedAmount === null
                ? BILLING_COPY.certifyOpen
                : BILLING_COPY.certifyAmend}
            </SecondaryButton>
          )}
        </div>
      )}
      {/* 048: what the client paid against this bill, and what it held back. */}
      <ClientBillReceipts
        billId={bill.id}
        projectId={projectId}
        isDraft={bill.status === 'draft'}
        isLocked={isLocked}
      />
    </section>
  );
}

/**
 * The abstract a packaged bill's payable comes from, in the client's own blocks.
 *
 * A row that is zero is left out, with one exception: the block totals and the payable always
 * print. A reader checking this against the document they were sent needs the structure to be the
 * same structure even on a bill that carries no recoveries — and a missing "Total recoveries"
 * reads as a figure that was forgotten rather than one that is nil.
 */
function Settlement({
  settlement,
  lead,
}: {
  settlement: NonNullable<ClientBill['settlement']>;
  /**
   * Rows printed above the work done, where the quote put something there (2026-10-13).
   *
   * Inside the first block rather than above the heading, because they are the same chain: the
   * schedule total, what the quote took off, the work done, the tax added. Two blocks under two
   * headings would make a reader stitch them back together.
   */
  lead?: ReactNode;
}) {
  const row = (label: string, value: number, always = false) =>
    always || value !== 0 ? { label, value } : null;

  const blocks: { rows: { label: string; value: number }[]; total: string }[] =
    [
      {
        rows: [
          row(BILLING_COPY.settlementWorkDone, settlement.workDone, true),
          row(
            BILLING_COPY.settlementReleaseWithheld,
            settlement.releaseWithheld,
          ),
          row(BILLING_COPY.settlementCgst, settlement.cgstAmount),
          row(BILLING_COPY.settlementSgst, settlement.sgstAmount),
          row(BILLING_COPY.settlementIgst, settlement.igstAmount),
        ].filter((r): r is { label: string; value: number } => r !== null),
        total: BILLING_COPY.settlementWorkTotal,
      },
      {
        rows: [
          row(BILLING_COPY.settlementRecoveryDiesel, settlement.recoveryDiesel),
          row(
            BILLING_COPY.settlementDebitAgainstCivil,
            settlement.debitAgainstCivil,
          ),
          row(
            BILLING_COPY.settlementOtherRecoveries,
            settlement.otherRecoveries,
          ),
          row(
            BILLING_COPY.settlementMechanicalDebit,
            settlement.mechanicalDebit,
          ),
        ].filter((r): r is { label: string; value: number } => r !== null),
        total: BILLING_COPY.settlementRecoveriesTotal,
      },
      {
        rows: [
          row(
            BILLING_COPY.settlementMobilizationAdvance,
            settlement.mobilizationAdvance,
          ),
          row(BILLING_COPY.settlementRetention, settlement.retentionAmount),
          row(
            BILLING_COPY.settlementPerformanceSecurity,
            settlement.performanceSecurity,
          ),
          row(BILLING_COPY.settlementTheftWithheld, settlement.theftWithheld),
        ].filter((r): r is { label: string; value: number } => r !== null),
        total: BILLING_COPY.settlementDeductionsTotal,
      },
    ];
  const totals = [
    settlement.workTotal,
    settlement.recoveriesTotal,
    settlement.deductionsTotal,
  ];

  return (
    <section className="max-w-sm space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {BILLING_COPY.settlementHeading}
      </h3>
      <dl className="space-y-1 rounded border border-gray-200 p-3 text-sm">
        {blocks.map((block, index) => (
          <div
            key={block.total}
            className={index > 0 ? 'border-t border-gray-100 pt-2' : undefined}
          >
            {index === 0 ? lead : null}
            {block.rows.map((r) => (
              <Figure key={r.label} label={r.label} value={r.value} muted />
            ))}
            <Figure label={block.total} value={totals[index]} />
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2">
          <Figure
            label={BILLING_COPY.settlementTds}
            value={settlement.tdsAmount}
            muted
          />
          <Figure
            label={BILLING_COPY.settlementPayable}
            value={settlement.payable}
            strong
          />
        </div>
      </dl>
      <p className="text-xs text-gray-500">{BILLING_COPY.settlementNote}</p>
    </section>
  );
}

/**
 * What the schedule said, and what the quote did to it (2026-10-13).
 *
 * Reported on RA-05: the lines came to ₹56,986.00 at the rates printed on the tender, the bill said
 * ₹50,837.21, and nothing on the screen said why. The client's own abstract prints these two rows
 * above its payable for exactly that reason.
 *
 * The figure is the magnitude and the label carries the direction, as the deduction rows below
 * already do — a column of positive numbers with "Less" beside them reads at a glance, and a lone
 * negative in the middle of it reads as a mistake.
 */
function QuoteRows({ bill }: { bill: ClientBill }) {
  if (bill.quotedPercentage === 0) return null;
  return (
    <>
      <Figure
        label={BILLING_COPY.quoteScheduleTotal}
        value={bill.boqGrossAmount}
        muted
      />
      <Figure
        label={BILLING_COPY.quoteAdjustmentLabel(
          percentLabel(Math.abs(bill.quotedPercentage)),
          bill.quotedPercentage < 0,
        )}
        value={Math.abs(bill.quoteAdjustment)}
        muted
      />
    </>
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
