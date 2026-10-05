'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  ABSTRACT_BLOCKS,
  CHECK_LIST_ANSWERS,
  type BillPackageClaim,
  type CheckListAnswer,
  certifyBillPackage,
  downloadWorkbook,
  getAbstract,
  getBillPackage,
  getCheckList,
  getDebitRegister,
  isEditable,
  issueBillPackage,
  proposalLabel,
  setCheckList,
  abandonBillPackage,
  applyDebit,
  recordDebit,
  reviseBillPackage,
  setClaim,
} from '@/app/lib/api/bill-packages';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import MeasurementSheet from '@/app/ui/projects/measurement-sheet';
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
  /** Which line's measurement sheet is open. One at a time: two expanded sheets is a scroll. */
  const [sheetFor, setSheetFor] = useState<string | null>(null);

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
  const { data: checkList } = useQuery({
    queryKey: ['billCheckList', packageId],
    queryFn: () => getCheckList(packageId),
  });

  const refresh = () => {
    for (const key of [
      'billPackage',
      'billAbstract',
      'billRegister',
      'billCheckList',
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key, packageId] });
    }
  };

  const issue = useMutation({
    mutationFn: () => issueBillPackage(packageId),
    onSuccess: (result) => {
      setError(null);
      // FR-027a and FR-043a: both are **reported**, never a refusal. A bill that cannot be produced
      // because a permanent account number is unrecorded is worse than one produced with a blank
      // somebody fills in by hand — so the gaps are stated and the bill goes out.
      const gaps: string[] = [];
      if (result.missingHeaderFields.length > 0) {
        gaps.push(
          `Not on file: ${result.missingHeaderFields.join(', ')} — printed blank on every sheet.`,
        );
      }
      if (result.checkListGaps.length > 0) {
        gaps.push(
          `${result.checkListGaps.length} check-list question(s) unanswered or answered no.`,
        );
      }
      setNotice(
        gaps.length > 0
          ? `Issued. ${gaps.join(' ')}`
          : 'Issued. Every figure is now frozen, and this bill will reproduce exactly as it stands.',
      );
      refresh();
    },
    onError: (err: unknown) => {
      setNotice(null);
      setError(describe(err));
    },
  });

  const download = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await downloadWorkbook(
        packageId,
        pkg?.label ?? 'bill',
      );
      // A blob URL carries no filename, so the `download` attribute is the only way to say what the
      // file is called — the reason `download-file.ts` exists and uses an anchor rather than
      // `window.open`.
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    onError: (err: unknown) => setError(describe(err)),
  });

  if (isLoading || !pkg) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading the bill…
      </p>
    );
  }

  const editable = isEditable(pkg.status);

  return (
    <div className="flex flex-col gap-8">
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
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            {download.isPending ? 'Producing…' : 'Download the workbook'}
          </Button>
          {editable && (
            <Button onClick={() => issue.mutate()} disabled={issue.isPending}>
              {issue.isPending ? 'Issuing…' : 'Issue'}
            </Button>
          )}
          {editable && (
            // 025 FR-030. A draft composed for the wrong period or the wrong counterparty had no
            // way out; the endpoint has existed since 023 and nothing called it. Abandoned rather
            // than deleted — the period stays accounted for.
            <Button
              intent="write"
              onClick={() => {
                if (
                  window.confirm(
                    'Abandon this draft? The period stays recorded as one somebody opened and chose not to bill.',
                  )
                ) {
                  abandonBillPackage(packageId)
                    .then(() => {
                      setNotice('Abandoned.');
                      refresh();
                    })
                    .catch((err: unknown) => setError(describe(err)));
                }
              }}
            >
              Abandon
            </Button>
          )}
          {!editable && pkg.status === 'issued' && (
            <Button
              onClick={() => {
                const reason = window.prompt(
                  'Why is this issued bill being revised? The revision is visible as a revision, not as a new bill.',
                );
                if (reason) {
                  reviseBillPackage(packageId, reason)
                    .then(() => {
                      setNotice('Revised. The figures are editable again.');
                      refresh();
                    })
                    .catch((err: unknown) => setError(describe(err)));
                }
              }}
            >
              Revise
            </Button>
          )}
          {!editable && pkg.status === 'issued' && (
            <Button
              onClick={() => {
                const amount = window.prompt(
                  'What did they certify? Kept beside the billed figure, never instead of it.',
                );
                if (amount) {
                  certifyBillPackage(packageId, amount)
                    .then(() => {
                      setNotice('Certified amount recorded.');
                      refresh();
                    })
                    .catch((err: unknown) => setError(describe(err)));
                }
              }}
            >
              Record certification
            </Button>
          )}
        </div>
      </header>

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
      {!editable && (
        <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
          This bill has been issued, so its lines cannot be edited. A bill is a
          document that was sent — reconciling a payment against one whose
          history has moved is the one thing nobody can do.
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

      {/* ── The lines ─────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-2 font-medium text-gray-900">
          Proposed lines ({pkg.claims.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
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
              {pkg.claims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  editable={editable}
                  packageId={packageId}
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
      </section>

      {/* ── The abstract ──────────────────────────────────────────────── */}
      {abstract && (
        <section>
          <h3 className="mb-1 font-medium text-gray-900">Abstract</h3>
          <p className="mb-2 text-xs text-gray-500">
            Tax basis: <strong>{abstract.taxBasis}</strong> (
            {abstract.taxBasisSource.replace(/_/g, ' ')}) — shown because a tax
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
                {ABSTRACT_BLOCKS.map((block) => (
                  <>
                    <tr key={block.title} className="bg-gray-50">
                      <td
                        className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600"
                        colSpan={4}
                      >
                        {block.title}
                      </td>
                    </tr>
                    {block.rows.map((row) => (
                      <tr
                        key={`${block.title}-${row.key}`}
                        className={row.isTotal ? 'font-semibold' : undefined}
                      >
                        <td className="px-3 py-2">{row.label}</td>
                        {/* Printed as sent. See this file's docblock for the rupee that settles it. */}
                        <td className="px-3 py-2 text-right">
                          {abstract.columns.uptoDate[row.key] ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {abstract.columns.uptoPrevious[row.key] ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {abstract.columns.thisBill[row.key] ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </>
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
                          <td className="px-3 py-1.5">{row.description}</td>
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

      {/* ── The check list ───────────────────────────────────────────── */}
      {checkList && (
        <section>
          <h3 className="mb-1 font-medium text-gray-900">Check list</h3>
          <p className="mb-2 text-xs text-gray-500">
            An unanswered question is <strong>not</strong> an answer of no —
            &ldquo;we checked and it is not attached&rdquo; and &ldquo;nobody has
            looked&rdquo; call for different actions. Nothing here ever refuses
            an issue.
          </p>
          <ul className="space-y-2">
            {checkList.items.map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center gap-3 text-sm"
              >
                <span className="w-6 text-gray-500">{item.position}.</span>
                <span className="min-w-[18rem] flex-1">{item.text}</span>
                <select
                  value={item.answer ?? ''}
                  disabled={!editable}
                  onChange={(event) => {
                    const value = event.target.value;
                    void setCheckList(packageId, [
                      {
                        questionKey: item.key,
                        ...(value
                          ? { answer: value as CheckListAnswer }
                          : {}),
                      },
                    ])
                      .then(() => refresh())
                      .catch((err: unknown) => setError(describe(err)));
                  }}
                  className="rounded-md border border-gray-300 px-2 py-1"
                >
                  <option value="">— unanswered —</option>
                  {CHECK_LIST_ANSWERS.map((answer) => (
                    <option key={answer} value={answer}>
                      {answer.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">{checkList.footer}</p>
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
  sheetOpen,
  onToggleSheet,
  onSave,
}: {
  packageId: string;
  sheetOpen: boolean;
  onToggleSheet: () => void;
  claim: BillPackageClaim;
  editable: boolean;
  onSave: (claimedQty: string, reason?: string) => Promise<void>;
}) {
  const [claimed, setClaimed] = useState(claim.claimedQty);
  const [reason, setReason] = useState(claim.reason ?? '');
  const [saving, setSaving] = useState(false);

  const changed = claimed !== claim.claimedQty;
  const differsFromProposal =
    claim.proposedQty === null || claimed !== claim.proposedQty;
  const needsReason = differsFromProposal && Number(claimed) !== 0;

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

function describe(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string };
  };
  if (anyErr?.status === 423) {
    return 'This project is locked, so nothing can be written to the bill. This is not a permission problem.';
  }
  if (anyErr?.status === 404) {
    return 'Not found. It may belong to another company.';
  }
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'The request was refused and the server gave no reason.'
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
