'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { useState } from 'react';

import {
  abstractBlocksFor,
  type BillPackageClaim,
  getAbstract,
  getBillPackage,
  getDebitRegister,
  isEditable,
  proposalLabel,
  applyDebit,
  recordDebit,
  setClaim,
} from '@/app/lib/api/bill-packages';
import { downloadDebitNote, getRaBill } from '@/app/lib/api/billing';
import { SETTLEMENT_COPY, projectsLabel } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { dateLabel } from '@/app/lib/format';
import BillAdjustments from '@/app/ui/projects/bill-adjustments';
import BillDeductionLines from '@/app/ui/projects/bill-deduction-lines';
import BillLifecycle, { describe } from '@/app/ui/projects/bill-lifecycle';
import RaBillSettlement from '@/app/ui/projects/ra-bill-settlement';
import { Button } from '@/app/ui/button';
import MeasurementSheet from '@/app/ui/projects/measurement-sheet';
import {
  AddNonBoqItem,
  NonBoqItemEditor,
} from '@/app/ui/projects/non-boq-items';
import StatusBadge from '@/app/ui/status-badge';

/**
 * One bill package: its lines, its abstract, its register and its check list (024 Story 3 to 5).
 *
 * ## Nothing on this screen computes a figure
 *
 * 024 FR-009, and the reason is in the client's own document. Its block A totals 21,73,189 while
 * its two displayed taxes sum to 21,73,190 — because nine per cent of 18,41,686 is 1,65,751.74, and
 * the sheet rounds each cell for the eye while totalling the unrounded values. The API computes at
 * full precision and rounds **once**. A second rounding in the browser would disagree with the
 * paper the client signed, by a rupee, in four places.
 *
 * So every money cell below prints a string the server sent. There is no `toFixed`, no `reduce`,
 * and no sum.
 *
 * ## The two kinds of empty
 *
 * A proposal of `null` is **no measurement** — an award line mapped to no BOQ line, which the
 * subcontract model permits. A proposal of zero is a measurement that read nothing. `proposalLabel`
 * is the one place that decides how each reads, because on the subcontractor direction collapsing
 * them would print "nothing was done this month" for every unmapped line of every bill.
 */
export default function BillPackageDetail({
  packageId,
}: {
  packageId: string;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A debit note read in the page rather than saved (2026-10-14). */
  const { view, viewer } = useFileViewer();
  /** Which line's measurement sheet is open. One at a time: two expanded sheets is a scroll. */
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  /** Opens the unmeasured lines back up on an issued bill — see `acted` below. */
  const [showEveryLine, setShowEveryLine] = useState(false);

  const { data: pkg, isLoading } = useQuery({
    queryKey: ['billPackage', packageId],
    queryFn: () => getBillPackage(packageId),
  });
  const { data: abstract } = useQuery({
    queryKey: ['billAbstract', packageId],
    queryFn: () => getAbstract(packageId),
  });
  const { data: register } = useQuery({
    queryKey: ['billRegister', packageId],
    queryFn: () => getDebitRegister(packageId),
  });

  // A certified subcontractor bill is paid here, and each payment produces its payment advice.
  const certifiedRaBillId =
    pkg?.direction === 'to_subcontractor' && pkg.status === 'certified'
      ? pkg.raBillId ?? null
      : null;
  const { data: raBill } = useQuery({
    queryKey: ['raBill', certifiedRaBillId],
    queryFn: () => getRaBill(certifiedRaBillId as string),
    enabled: certifiedRaBillId !== null,
  });

  const refresh = () => {
    for (const key of ['billPackage', 'billAbstract', 'billRegister']) {
      void queryClient.invalidateQueries({ queryKey: [key, packageId] });
    }
    void queryClient.invalidateQueries({ queryKey: ['raBill'] });
  };

  if (isLoading || !pkg) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading the bill…
      </p>
    );
  }

  const editable = isEditable(pkg.status);
  // Null and "0.000" are different facts on a claim — a line with no measurement source against a
  // line measured as nothing — but neither is a quantity to bill, so both count as nothing here.
  const nothingProposed =
    pkg.claims.length > 0 &&
    pkg.claims.every(
      (claim) => claim.proposedQty === null || Number(claim.proposedQty) === 0,
    );

  /**
   * The lines this bill actually acted on (2026-10-13).
   *
   * Reported on an issued bill: 120 rows, of which two carried a quantity. A bill measures a
   * handful of items out of the project's whole schedule, and printing every unmeasured line in
   * between buries the two that are the bill.
   *
   * Three ways a line counts as acted on, and the last two matter as much as the first:
   *
   * - a claimed quantity — the obvious case, and `!== 0` rather than `> 0` so a negative
   *   correction on a revision is still something this bill did;
   * - a **proposed** quantity, even where the claim is nil — approved work was measured against
   *   this line and somebody struck it out, which is a decision and not an absence;
   * - a reason, which only exists where somebody changed a figure by hand.
   *
   * `proposedQty` is nullable and null is not zero: null is an award line mapped to no BOQ line,
   * where there was nothing to read. Neither is an entry, so both fall out here.
   */
  const acted = pkg.claims.filter(
    (claim) =>
      Number(claim.claimedQty) !== 0 ||
      Number(claim.proposedQty ?? 0) !== 0 ||
      claim.reason !== null,
  );
  /**
   * **Every line while the bill is a draft.** This table is the entry grid then, and a schedule
   * line hidden because it carries nothing yet is a line nobody can claim against — collapsing it
   * would remove the only way to bill it. The collapse is for a document that has been sent, where
   * the rows are a record rather than a form.
   */
  const claims = editable || showEveryLine ? pkg.claims : acted;
  const hiddenClaims = pkg.claims.length - claims.length;

  return (
    <div className="flex flex-col gap-8">
      {viewer}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900">
            {pkg.label}
            <StatusBadge status={pkg.status} />
          </h2>
          <p className="text-sm text-gray-600">
            {dateLabel(pkg.periodFrom)} – {dateLabel(pkg.periodTo)} ·{' '}
            {pkg.direction === 'to_client'
              ? 'to the client'
              : 'to a subcontractor'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Retention {pkg.rates.retentionFraction} · CGST{' '}
            {pkg.rates.cgstFraction} · SGST {pkg.rates.sgstFraction} · IGST{' '}
            {pkg.rates.igstFraction} · TDS {pkg.rates.tdsFraction} — the rates
            this bill was computed at, frozen onto it.
          </p>
        </div>
      </header>

      <BillLifecycle
        pkg={pkg}
        abstract={abstract}
        onChanged={refresh}
        onNotice={(message) => {
          setError(null);
          setNotice(message);
        }}
        onError={(message) => {
          setNotice(null);
          setError(message);
        }}
      />

      {notice && (
        <p
          className="rounded-md bg-green-50 p-3 text-sm text-green-800"
          role="status"
        >
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {!editable && pkg.status !== 'abandoned' && (
        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          {pkg.status === 'pending_approval' || pkg.status === 'approved'
            ? 'This bill is with its approver, so its lines are locked — an approval is of the figures the approver saw. Withdraw it to draft to change anything.'
            : 'This bill has been issued, so its lines cannot be edited. A bill is a document that was sent — reconciling a payment against one whose history has moved is the one thing nobody can do.'}
        </p>
      )}
      {pkg.unpricedClaimedCount > 0 && editable && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {pkg.unpricedClaimedCount} line(s) carry a claim and no rate. Issuing
          would bill that work at nothing, so it is refused — price the lines
          first. A zero rate is almost always an unpriced line rather than free
          work.
        </p>
      )}
      {/* Every line proposing zero is what a quiet month looks like **and** what a broken system
          looks like. Reported 2026-10-08 as the second. The award decides which lines appear and
          at what rate; approved daily work decides how much — and that fact is nowhere on this
          screen unless it is said. */}
      {nothingProposed && (
        <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
          Every line proposes 0.000, because no approved daily work falls in{' '}
          {dateLabel(pkg.periodFrom)} – {dateLabel(pkg.periodTo)}. Quantities
          come from approved daily reports, not from the award — the award sets
          which lines are billable and at what rate.{' '}
          {pkg.latestApprovedWork ? (
            <>
              The latest approved report on this project is{' '}
              <strong>{dateLabel(pkg.latestApprovedWork.workDate)}</strong> (
              {pkg.latestApprovedWork.dprNumber}).
              {editable
                ? ' Discard this bill and compose one for a period that covers it.'
                : ''}
            </>
          ) : (
            <>
              No daily report has been approved on this project yet, so there is
              nothing to bill against anywhere.
            </>
          )}
        </p>
      )}

      {/* ── The lines ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 font-medium text-gray-900">
          Proposed lines ({claims.length})
        </h3>
        {/* The count in the heading is what is on screen, and this says what is not. Both
            numbers, because "118 hidden" without "2 shown" reads as a filter that has eaten the
            bill. */}
        {hiddenClaims > 0 && claims.length > 0 && (
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <p className="text-xs text-gray-500">
              Showing the {claims.length} line
              {claims.length === 1 ? '' : 's'} this bill claimed.{' '}
              {hiddenClaims} other schedule line
              {hiddenClaims === 1 ? ' carries' : 's carry'} no quantity.
            </p>
            <button
              type="button"
              onClick={() => setShowEveryLine(true)}
              className="text-xs font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Show every schedule line
            </button>
          </div>
        )}
        {showEveryLine && !editable && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowEveryLine(false)}
              className="text-xs font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Show only what was claimed
            </button>
          </div>
        )}
        {/* Lines exist and none carries a quantity — a different fact from a bill with no lines,
            and one a table of headers above nothing would not state. */}
        {claims.length === 0 ? (
          <div className="flex flex-wrap items-baseline gap-2 rounded-md border border-dashed border-gray-300 p-6">
            <p className="text-sm text-gray-600">
              No line on this bill carries a quantity. Every schedule line was
              considered and nothing was claimed.
            </p>
            {hiddenClaims > 0 && (
              <button
                type="button"
                onClick={() => setShowEveryLine(true)}
                className="text-xs font-medium text-blue-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                Show every schedule line
              </button>
            )}
          </div>
        ) : (
        /* Bounded on both axes, and the header sticks — the same reason `bill-sheet.tsx` gives:
            a real schedule is 231 lines, several of them a full specification deep, and an
            unbounded grid pushes the document to tens of thousands of pixels behind a shell that
            is clipped at the viewport. */
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="sticky top-0 z-10 bg-white text-left text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgb(229,231,235)]">
              <tr>
                <th className="px-3 py-2">BOQ</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Proposed</th>
                <th className="px-3 py-2 text-right">Claimed</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  editable={editable}
                  packageId={packageId}
                  canEditItem={
                    editable && claim.nonBoq && pkg.direction === 'to_client'
                  }
                  onItemSaved={() => {
                    setError(null);
                    setNotice('Non-BOQ item saved.');
                    refresh();
                  }}
                  sheetOpen={sheetFor === claim.scheduleLineId}
                  onToggleSheet={() =>
                    setSheetFor(
                      sheetFor === claim.scheduleLineId
                        ? null
                        : claim.scheduleLineId,
                    )
                  }
                  onSave={async (claimedQty, reason) => {
                    try {
                      await setClaim(packageId, claim.id, {
                        claimedQty,
                        ...(reason ? { reason } : {}),
                      });
                      setError(null);
                      refresh();
                    } catch (err) {
                      setError(describe(err));
                    }
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* ── Non-BOQ items (2026-10-14) ──────────────────────────────── */}
        {editable && pkg.direction === 'to_client' && (
          <div className="mt-4">
            <AddNonBoqItem
              packageId={packageId}
              onSaved={() => {
                setError(null);
                setNotice(
                  'Non-BOQ item added. It is on this bill now, and later bills to this client will list it too.',
                );
                refresh();
              }}
            />
          </div>
        )}
        {editable && pkg.direction === 'to_subcontractor' && (
          <p className="mt-3 text-xs text-gray-500">
            Need a non-BOQ item? A subcontractor’s are part of their award: add
            it to the work order on Subcontractors, and every bill under it
            lists it here — enter its quantity on the line.
          </p>
        )}
      </section>

      {/* ── The month's entered figures (025 FR-044) ──────────────────── */}
      {editable && abstract && (
        <BillAdjustments
          packageId={packageId}
          direction={pkg.direction}
          abstract={abstract}
          debitTotal={register?.recoveredOnThisPackage ?? null}
          onSaved={() => {
            setError(null);
            setNotice('Figures saved. The abstract below has moved with them.');
            refresh();
          }}
        />
      )}
      {editable && pkg.direction === 'to_subcontractor' && (
        <BillDeductionLines
          key={JSON.stringify(pkg.deductionLines ?? [])}
          pkg={pkg}
          onSaved={() => {
            setError(null);
            setNotice('Lines saved. The abstract below has moved with them.');
            refresh();
          }}
          onError={(message) => setError(message)}
        />
      )}

      {/* ── The abstract ──────────────────────────────────────────────── */}
      {abstract && (
        <section>
          <h3 className="mb-1 font-medium text-gray-900">Abstract</h3>
          <p className="mb-2 text-xs text-gray-500">
            Tax basis: <strong>{projectsLabel(abstract.taxBasis)}</strong> (
            {projectsLabel(abstract.taxBasisSource)}) — shown because a tax
            decision nobody can see is a tax decision nobody made.
            {abstract.cumulativeProvisional && (
              <>
                {' '}
                The <strong>Upto date</strong> column is{' '}
                <strong>provisional</strong>: the cumulative position freezes
                when the bill is issued, so this figure can still move.
              </>
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Particulars</th>
                  <th className="px-3 py-2 text-right">Upto date</th>
                  <th className="px-3 py-2 text-right">Upto previous</th>
                  <th className="px-3 py-2 text-right">This month</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {abstractBlocksFor(pkg.direction).map((block) => (
                  // The key belongs on the fragment, not on the first row inside it. A bare `<>` in
                  // a list is itself the child React is keying, so keying its children instead
                  // leaves the list unkeyed — which is what the warning was reporting.
                  <React.Fragment key={block.title}>
                    <tr className="bg-gray-50">
                      <td
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600"
                        colSpan={4}
                      >
                        {block.title}
                      </td>
                    </tr>
                    {block.rows
                      .filter(
                        (row) =>
                          !row.hideWhenNil ||
                          [
                            abstract.columns.uptoDate,
                            abstract.columns.uptoPrevious,
                            abstract.columns.thisBill,
                          ].some((column) => Number(column[row.key] ?? 0) !== 0),
                      )
                      .flatMap((row) =>
                        // The bill's own lines go just before the block's total.
                        row.isTotal && block.customSection
                          ? [
                              ...(abstract.deductionLines ?? [])
                                .filter((line) => line.section === block.customSection)
                                .map((line) => ({
                                  key: `custom:${line.label}`,
                                  label: line.label,
                                  isTotal: false,
                                  custom: line,
                                })),
                              row,
                            ]
                          : [row],
                      )
                      .map((row) => (
                      <tr
                        // Keyed by the **label**, not the column: a client's abstract prints the
                        // taxable amount twice, once as the total of 1A−1B and once as what the
                        // tax was computed on, exactly as the authority's own sheet does.
                        key={`${block.title}-${row.label}`}
                        className={row.isTotal ? 'font-semibold' : undefined}
                      >
                        <td className="px-3 py-2">{row.label}</td>
                        {/* Printed as sent. See this file's docblock for the rupee that settles it. */}
                        <td className="px-3 py-2 text-right">
                          {'custom' in row
                            ? row.custom.uptoDate
                            : abstract.columns.uptoDate[row.key] ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {'custom' in row
                            ? row.custom.uptoPrevious
                            : abstract.columns.uptoPrevious[row.key] ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {'custom' in row
                            ? row.custom.thisBill
                            : abstract.columns.thisBill[row.key] ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
                <tr className="border-t-2 border-gray-300 text-base font-semibold">
                  <td className="px-3 py-2">Amount payable</td>
                  <td className="px-3 py-2 text-right">
                    {abstract.columns.uptoDate.payable ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {abstract.columns.uptoPrevious.payable ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {abstract.columns.thisBill.payable ?? '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Payments and payment advice (a certified subcontractor bill) ─── */}
      {raBill && (
        <section>
          <h3 className="mb-1 font-medium text-gray-900">
            Payments and payment advice
          </h3>
          <p className="mb-2 text-xs text-gray-500">
            Record each payment with its bank reference and transaction number;
            each one then produces a payment advice on the company’s letterhead.
          </p>
          <RaBillSettlement bill={raBill} />
        </section>
      )}

      {/* ── The debit register ────────────────────────────────────────── */}
      {register && (
        <section>
          <h3 className="mb-1 font-medium text-gray-900">Debit register</h3>
          <p className="mb-2 text-xs text-gray-500">
            {register.asAtIssue ? (
              <>
                This bill has been issued, so the register shown is the register{' '}
                <strong>as at issue</strong> — a debit recorded afterwards
                cannot change a document that has been signed.
              </>
            ) : (
              <>
                Every debit on the project, including those recovered on earlier
                bills: the running total is the point of a register.
              </>
            )}{' '}
            Recovered on this bill: {register.recoveredOnThisPackage} of{' '}
            {register.total}.
          </p>
          {editable && <RecordDebit projectId={pkg.projectId} onDone={refresh} />}
          {register.groups.length === 0 ? (
            <p className="text-sm text-gray-600">No debits on this project.</p>
          ) : (
            <div className="space-y-4">
              {register.groups.map((group, index) => (
                <div key={`${group.heading ?? 'ungrouped'}-${index}`}>
                  <p className="text-sm font-medium text-gray-800">
                    {group.heading ?? 'Ungrouped'}
                  </p>
                  <table className="mt-1 min-w-full divide-y divide-gray-200 text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {group.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-1.5">
                            {row.description}
                            {/* 028 FR-019. The number the note itself carries, so the register and
                                the signed document cannot disagree about which debit this is.
                                Absent on debits raised before the series existed. */}
                            {row.noteNumber && (
                              <span className="block font-mono text-xs text-gray-500">
                                {row.noteNumber}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {row.location ?? ''}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {row.amountWithTax}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-500">
                            {row.recoveredOn
                              ? `debited in ${row.recoveredOn}`
                              : 'not yet recovered'}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {/* 028 FR-018. The standalone note a subcontractor signs to
                                acknowledge the recovery — the register already prints inside the
                                package PDF, and this is the single-debit document. */}
                            <Button
                              type="button"
                              intent="read"
                              onClick={() =>
                                void view({
                                  title: row.noteNumber ?? 'Debit note',
                                  fileName: `${row.noteNumber ?? 'Debit note'}.pdf`,
                                  load: () =>
                                    downloadDebitNote(
                                      row.id,
                                      `${row.noteNumber ?? 'Debit note'}.pdf`,
                                    ),
                                })
                              }
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                downloadDebitNote(
                                  row.id,
                                  `${row.noteNumber ?? 'Debit note'}.pdf`,
                                )
                                  .then(({ blob, filename }) =>
                                    saveBlob(blob, filename),
                                  )
                                  .catch((err: unknown) =>
                                    setError(describe(err)),
                                  );
                              }}
                            >
                              {SETTLEMENT_COPY.debitNote}
                            </Button>
                            {/* 025 FR-029. A debit is recovered on exactly one bill; the server
                                refuses a second application by name, so the control is offered and
                                its refusal is shown rather than guessed at here. */}
                            {editable && !row.recoveredOnPackageId && (
                              <Button
                                onClick={() => {
                                  applyDebit(row.id, packageId)
                                    .then(() => {
                                      setNotice(
                                        'Recovered on this bill. It cannot be recovered on another.',
                                      );
                                      refresh();
                                    })
                                    .catch((err: unknown) =>
                                      setError(describe(err)),
                                    );
                                }}
                              >
                                Recover here
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );
}

/**
 * One line, editable while the bill is a draft (024 FR-006, FR-007).
 *
 * The reason field appears the moment the claim differs from the proposal, and Save is refused
 * without one. Returning the claim to the proposal needs no reason — and the **API clears** the one
 * that was there, rather than this form doing it, because a reason beside a zero variance argues on
 * the measurement sheet for a deduction the bill does not make.
 */
function ClaimRow({
  claim,
  editable,
  packageId,
  canEditItem,
  onItemSaved,
  sheetOpen,
  onToggleSheet,
  onSave,
}: {
  packageId: string;
  /** A client's non-BOQ item on a draft: its description, unit and rate can be corrected. */
  canEditItem: boolean;
  onItemSaved: () => void;
  sheetOpen: boolean;
  onToggleSheet: () => void;
  claim: BillPackageClaim;
  editable: boolean;
  onSave: (claimedQty: string, reason?: string) => Promise<void>;
}) {
  const [claimed, setClaimed] = useState(claim.claimedQty);
  const [reason, setReason] = useState(claim.reason ?? '');
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(false);

  const changed = claimed !== claim.claimedQty;
  // A line with no measurement source — a non-BOQ item — is measured here, so there is no proposal
  // to depart from and no reason to give (2026-10-14). A departure from a measurement needs one.
  const needsReason =
    claim.proposedQty !== null &&
    Number(claimed) !== Number(claim.proposedQty);

  return (
    <>
    <tr className={claim.overClaimed ? 'bg-amber-50' : undefined}>
      <td className="px-3 py-2 whitespace-nowrap">
        {/* 025 FR-028. Until now this existed only inside the downloaded workbook, so answering
            "where did this figure come from?" meant producing a document. */}
        <button
          type="button"
          onClick={onToggleSheet}
          className="font-medium text-blue-700 hover:underline"
          aria-expanded={sheetOpen}
        >
          {claim.boqNo}
        </button>
      </td>
      <td className="max-w-md px-3 py-2">
        <span className="line-clamp-2">{claim.description}</span>
        {claim.nonBoq && (
          <span className="ml-1 rounded bg-indigo-100 px-1 text-xs font-medium text-indigo-800">
            Non-BOQ
          </span>
        )}
        {canEditItem && !editingItem && (
          <button
            type="button"
            onClick={() => setEditingItem(true)}
            className="ml-2 text-xs font-medium text-blue-700 underline"
          >
            Edit item
          </button>
        )}
        {claim.overClaimed && (
          <span className="ml-1 rounded bg-amber-200 px-1 text-xs font-medium text-amber-900">
            over-claimed
          </span>
        )}
        {claim.exceedsScope && (
          <span className="ml-1 text-xs text-gray-500">
            past scope — {claim.remainingQty} remaining
          </span>
        )}
      </td>
      <td className="px-3 py-2">{claim.unit}</td>
      {/* The one place that decides how a proposal reads. `no measurement` and `0.000` are
          different facts and the screen must not collapse them (FR-005). */}
      <td className="px-3 py-2 text-right">
        {claim.proposalSource === 'no_measurement_source' ? (
          <span className="text-xs italic text-gray-500">
            {proposalLabel(claim)}
          </span>
        ) : (
          proposalLabel(claim)
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {editable ? (
          <input
            inputMode="decimal"
            value={claimed}
            onChange={(event) => setClaimed(event.target.value)}
            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-right"
          />
        ) : (
          claim.claimedQty
        )}
      </td>
      <td className="px-3 py-2 text-right">{claim.rate}</td>
      <td className="px-3 py-2 text-right">{claim.amount}</td>
      <td className="px-3 py-2">
        {editable ? (
          <div className="flex flex-col gap-1">
            {needsReason && (
              <textarea
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why this differs from the approved measurement"
                className="w-64 rounded-md border border-gray-300 px-2 py-1 text-xs"
              />
            )}
            {changed && (
              <Button
                disabled={saving || (needsReason && reason.trim() === '')}
                onClick={async () => {
                  setSaving(true);
                  await onSave(
                    claimed,
                    needsReason ? reason.trim() : undefined,
                  );
                  setSaving(false);
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-600">{claim.reason ?? ''}</span>
        )}
      </td>
    </tr>
    {editingItem && (
      <tr className="bg-indigo-50/40">
        <td colSpan={8} className="px-3 py-3">
          <NonBoqItemEditor
            packageId={packageId}
            claim={claim}
            onSaved={onItemSaved}
            onClose={() => setEditingItem(false)}
          />
        </td>
      </tr>
    )}
    {sheetOpen && (
      <tr className="bg-gray-50">
        <td colSpan={8} className="px-3 py-3">
          <MeasurementSheet
            packageId={packageId}
            scheduleLineId={claim.scheduleLineId}
          />
        </td>
      </tr>
    )}
    </>
  );
}


/**
 * Raising a debit against a counterparty (025 FR-029).
 *
 * The endpoint has existed since 023 with no caller, so the register could be read and never
 * written: every debit in the system had to be inserted by hand. Four fields, because four are
 * required — the rest of the register's columns (location, dimensions, unit) are optional on the
 * API and a form that demanded them would refuse a debit nobody measured.
 *
 * **The amount with tax is entered, not derived.** A debit against a subcontractor is raised at a
 * figure somebody agreed, and computing it here from a rate this screen does not know would produce
 * a number that disagrees with the note already sent to them.
 */
function RecordDebit({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [amountWithTax, setAmountWithTax] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button className="mb-3" onClick={() => setOpen(true)}>
        Raise a debit
      </Button>
    );
  }

  return (
    <form
      className="mb-3 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        recordDebit(projectId, {
          ...(heading.trim() ? { groupHeading: heading.trim() } : {}),
          description: description.trim(),
          rate: amount.trim(),
          amount: amount.trim(),
          amountWithTax: amountWithTax.trim() || amount.trim(),
        })
          .then(() => {
            setError(null);
            setOpen(false);
            setDescription('');
            setAmount('');
            setAmountWithTax('');
            onDone();
          })
          .catch((err: unknown) => setError(describe(err)))
          .finally(() => setSaving(false));
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Heading</span>
        <input
          value={heading}
          onChange={(event) => setHeading(event.target.value)}
          placeholder="Debit against the ATMS equipment missing at site"
          className="w-72 rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Description</span>
        <input
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="w-72 rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Amount</span>
        <input
          required
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="w-32 rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">With tax</span>
        <input
          inputMode="decimal"
          value={amountWithTax}
          onChange={(event) => setAmountWithTax(event.target.value)}
          placeholder="same as amount"
          className="w-32 rounded-md border border-gray-300 px-3 py-2"
        />
      </label>
      <div className="flex items-center gap-2 pb-1">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Record'}
        </Button>
        <Button type="button" intent="write" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p className="w-full text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
