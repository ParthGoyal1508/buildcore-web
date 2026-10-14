'use client';

import clsx from 'clsx';
import { useState } from 'react';

import { decideApproval, resubmitApproval } from '@/app/lib/api/approvals';
import {
  type BillAbstract,
  type BillDocumentFormat,
  type BillPackage,
  abandonBillPackage,
  certifyBillPackage,
  downloadBillDocument,
  issueBillPackage,
  markBillShared,
  reviseBillPackage,
  submitBillPackage,
  withdrawBillPackage,
} from '@/app/lib/api/bill-packages';
import { downloadCertificate, downloadSignedCopy } from '@/app/lib/api/billing';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel } from '@/app/lib/format';
import { useCanWrite } from '@/app/lib/write-access';
import ActionReview from '@/app/ui/approvals/action-review';
import { Button } from '@/app/ui/button';
import {
  FieldLabelSpacer,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Where a bill stands and what can be done to it next (2026-10-13).
 *
 * Draft → approval → approved → issued → shared → certified. Each status offers exactly the step
 * that follows it, so nobody has to know the order: a draft is sent for approval, an approved bill
 * is issued, an issued bill is marked shared and certified.
 *
 * **The approval is decided here, on the bill.** When the person opening it is the one the chain
 * is waiting on, `ActionReview` shows Approve / Reject / Return inline — the Director reviewing a
 * bill does not have to go to the Approvals inbox and come back. `ActionReview` is imported, never
 * reimplemented, for the reason `letter-composer.tsx` gives.
 */
export default function BillLifecycle({
  pkg,
  abstract,
  onChanged,
  onNotice,
  onError,
}: {
  pkg: BillPackage;
  abstract: BillAbstract | undefined;
  onChanged: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const canWrite = useCanWrite();
  /** Which inline form is open — one at a time. */
  const [form, setForm] = useState<'share' | 'certify' | 'revise' | null>(
    null,
  );

  const toClient = pkg.direction === 'to_client';
  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      onNotice(done);
      setForm(null);
      onChanged();
    } catch (err) {
      onError(describe(err));
    } finally {
      setBusy(null);
    }
  };

  const approval = pkg.approval ?? null;
  const awaiting = pkg.status === 'pending_approval';

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <Steps pkg={pkg} />

      {/* ── Inline approval ───────────────────────────────────────────── */}
      {awaiting && approval && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-sm text-blue-900">
            Sent for approval
            {pkg.submittedAt ? ` on ${dateLabel(pkg.submittedAt)}` : ''}
            {approval.levelLabel
              ? ` — waiting on ${approval.levelLabel}${
                  approval.awaitingUserName
                    ? ` (${approval.awaitingUserName})`
                    : ''
                }, level ${approval.currentPosition} of ${approval.totalLevels}.`
              : '.'}{' '}
            The bill is locked while it is with the approver.
          </p>
          {/* 2026-10-14. Work billed at a rate nobody bid, on a quantity no daily report measured —
              the one thing on a bill an approver most needs to see before approving it. */}
          {pkg.nonBoqSummary.count > 0 && (
            <p className="mb-2 rounded-md border border-indigo-200 bg-indigo-50 p-2 text-sm text-indigo-900">
              <strong>
                Includes {pkg.nonBoqSummary.count} non-BOQ item
                {pkg.nonBoqSummary.count === 1 ? '' : 's'} · ₹
                {Number(pkg.nonBoqSummary.amount).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                })}
              </strong>{' '}
              — outside the {toClient ? 'tendered BOQ' : 'BOQ'}, billed at the
              entered rate and quantity. They are marked Non-BOQ in the lines
              below.
            </p>
          )}
          <ActionReview
            state={approval}
            entityLabel={`bill ${pkg.label}`}
            size="full"
            onDecide={async (action, reason) => {
              await decideApproval(approval.instanceId, { action, reason });
              onNotice(
                action === 'approve'
                  ? 'Approval recorded.'
                  : action === 'reject'
                  ? 'Rejected — the bill is back with its author as a draft.'
                  : 'Returned to the author for correction.',
              );
              // The chain's completion moves the bill on the server a moment after the decision.
              onChanged();
              setTimeout(onChanged, 800);
            }}
            onResubmit={async () => {
              await resubmitApproval('bill_package', pkg.id);
              onNotice('Sent back up the chain.');
              onChanged();
            }}
          />
        </div>
      )}

      {/* ── The next step ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {pkg.status === 'draft' && (
          <>
            <Button
              onClick={() =>
                run(
                  'submit',
                  () => submitBillPackage(pkg.id),
                  'Sent for approval. The approver sees Approve / Reject on this bill and in their Approvals inbox.',
                )
              }
              disabled={busy !== null}
            >
              {busy === 'submit' ? 'Sending…' : 'Send for approval'}
            </Button>
            <SecondaryButton
              hidden={!canWrite}
              onClick={() => {
                if (
                  window.confirm(
                    'Abandon this draft? The period stays recorded as one somebody opened and chose not to bill.',
                  )
                ) {
                  void run('abandon', () => abandonBillPackage(pkg.id), 'Abandoned.');
                }
              }}
              disabled={busy !== null}
            >
              Abandon
            </SecondaryButton>
          </>
        )}

        {pkg.status === 'approved' && (
          <Button
            onClick={() =>
              run(
                'issue',
                async () => {
                  const result = await issueBillPackage(pkg.id);
                  if (result.missingHeaderFields.length > 0) {
                    onNotice(
                      `Issued. Not on file: ${result.missingHeaderFields.join(', ')} — printed blank.`,
                    );
                  }
                },
                'Issued. Every figure is now frozen. Download it, send it, then mark it shared.',
              )
            }
            disabled={busy !== null}
          >
            {busy === 'issue' ? 'Issuing…' : 'Issue the bill'}
          </Button>
        )}

        {(pkg.status === 'pending_approval' || pkg.status === 'approved') && (
          <SecondaryButton
            hidden={!canWrite}
            onClick={() => {
              const reason = window.prompt(
                'Take this bill back to draft to change it? Say why — the approver will see it.',
              );
              if (reason !== null) {
                void run(
                  'withdraw',
                  () => withdrawBillPackage(pkg.id, reason || undefined),
                  'Back to draft. Send it for approval again when it is ready.',
                );
              }
            }}
            disabled={busy !== null}
          >
            Withdraw to draft
          </SecondaryButton>
        )}

        {(pkg.status === 'issued' || pkg.status === 'certified') && (
          <>
            {pkg.sharedAt ? (
              <SecondaryButton
                hidden={!canWrite}
                onClick={() => setForm(form === 'share' ? null : 'share')}
              >
                Update shared with
              </SecondaryButton>
            ) : (
              <Button onClick={() => setForm(form === 'share' ? null : 'share')}>
                Mark as shared
              </Button>
            )}
            <Button onClick={() => setForm(form === 'certify' ? null : 'certify')}>
              {pkg.status === 'certified' ? 'Amend certification' : 'Certify'}
            </Button>
            <SecondaryButton
              hidden={!canWrite}
              onClick={() => setForm(form === 'revise' ? null : 'revise')}
            >
              Record a revision
            </SecondaryButton>
          </>
        )}
      </div>

      {form === 'share' && (
        <ShareForm
          pkg={pkg}
          busy={busy === 'share'}
          onSubmit={(sharedTo) =>
            run(
              'share',
              () => markBillShared(pkg.id, sharedTo),
              `Recorded as shared with the ${toClient ? 'client' : 'subcontractor'}.`,
            )
          }
        />
      )}
      {form === 'certify' && (
        <CertifyForm
          pkg={pkg}
          abstract={abstract}
          busy={busy === 'certify'}
          onSubmit={(input) =>
            run(
              'certify',
              () => certifyBillPackage(pkg.id, input),
              toClient
                ? 'Certified amount recorded beside the billed figure.'
                : 'Certified. The bill can now be paid, and each payment can produce a payment advice.',
            )
          }
        />
      )}
      {form === 'revise' && (
        <ReviseForm
          busy={busy === 'revise'}
          onSubmit={(reason) =>
            run(
              'revise',
              () => reviseBillPackage(pkg.id, reason),
              'Revision recorded, with its reason. What the bill stated at issue is unchanged.',
            )
          }
        />
      )}

      <Facts pkg={pkg} />
      <CertifiedCopy pkg={pkg} onError={(m) => onError(m)} />
      <Downloads pkg={pkg} onError={(m) => onError(m)} />
    </section>
  );
}

const STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'pending_approval', label: 'Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'issued', label: 'Issued' },
  { key: 'shared', label: 'Shared' },
  { key: 'certified', label: 'Certified' },
] as const;

function Steps({ pkg }: { pkg: BillPackage }) {
  if (pkg.status === 'abandoned') {
    return <p className="text-sm text-gray-600">This draft was abandoned.</p>;
  }
  const reached = new Set<string>(['draft']);
  const order = ['draft', 'pending_approval', 'approved', 'issued', 'certified'];
  const at = order.indexOf(pkg.status);
  order.slice(0, at + 1).forEach((step) => reached.add(step));
  if (pkg.sharedAt) reached.add('shared');
  if (at >= order.indexOf('issued')) {
    reached.add('pending_approval');
    reached.add('approved');
  }
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Bill status">
      {STEPS.map((step, index) => (
        <li key={step.key} className="flex items-center gap-1">
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 font-medium',
              reached.has(step.key)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-500',
              step.key === pkg.status && 'ring-2 ring-blue-300 ring-offset-1',
            )}
            aria-current={
              step.key === pkg.status ? 'step' : undefined
            }
          >
            {step.label}
          </span>
          {index < STEPS.length - 1 && (
            <span className="text-gray-400" aria-hidden>
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Facts({ pkg }: { pkg: BillPackage }) {
  const facts: [string, string][] = [];
  if (pkg.counterpartyName) {
    facts.push([pkg.direction === 'to_client' ? 'Client' : 'Subcontractor', pkg.counterpartyName]);
  }
  if (pkg.approvedAt) facts.push(['Approved', dateLabel(pkg.approvedAt)]);
  if (pkg.issuedAt) facts.push(['Issued', dateLabel(pkg.issuedAt)]);
  if (pkg.sharedAt) {
    facts.push([
      'Shared',
      `${dateLabel(pkg.sharedAt)}${pkg.sharedTo ? ` — ${pkg.sharedTo}` : ''}`,
    ]);
  }
  if (pkg.certifiedAmount) {
    facts.push([
      'Certified',
      `₹${pkg.certifiedAmount}${pkg.certifiedAt ? ` on ${dateLabel(pkg.certifiedAt)}` : ''}${
        pkg.certifiedRemarks ? ` — ${pkg.certifiedRemarks}` : ''
      }`,
    ]);
  }
  if (pkg.revisionCount) {
    facts.push([
      'Revisions',
      `${pkg.revisionCount}${pkg.lastRevisionReason ? ` — latest: ${pkg.lastRevisionReason}` : ''}`,
    ]);
  }
  if (facts.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {facts.map(([term, value]) => (
        <div key={term} className="flex gap-2">
          <dt className="text-gray-500">{term}</dt>
          <dd className="text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The certified copy filed at Certify, once the bill is certified (2026-10-14).
 *
 * Either direction, one link: the server says which download holds it — the client bill's
 * certificate, or the signed copy on a subcontractor's RA bill — so this asks no question of its
 * own about where a direction keeps its paper.
 */
function CertifiedCopy({
  pkg,
  onError,
}: {
  pkg: BillPackage;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const copy = pkg.certifiedCopy;
  if (pkg.status !== 'certified' || !copy) return null;

  const download = async () => {
    setBusy(true);
    try {
      const { blob, filename } =
        copy.kind === 'client_certificate'
          ? await downloadCertificate(copy.clientBillId)
          : await downloadSignedCopy(copy.signedCopyId, copy.fileName);
      saveBlob(blob, filename || copy.fileName);
    } catch (err) {
      onError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        className="font-medium text-blue-700 underline hover:text-blue-900 disabled:opacity-50"
        onClick={() => void download()}
        disabled={busy}
      >
        {busy ? 'Downloading…' : 'Download certified copy'}
      </button>
      <span className="text-gray-500">{copy.fileName}</span>
    </div>
  );
}

function Downloads({
  pkg,
  onError,
}: {
  pkg: BillPackage;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const toClient = pkg.direction === 'to_client';
  const abstractName = toClient ? 'Payment Abstract' : 'Abstract';
  const name = `${pkg.counterpartyName ? `${pkg.counterpartyName} ` : ''}${pkg.label}`;

  const get = async (format: BillDocumentFormat, abstractOnly: boolean) => {
    const key = `${format}-${abstractOnly}`;
    setBusy(key);
    try {
      const { blob, filename } = await downloadBillDocument(pkg.id, name, format, {
        abstractOnly,
        abstractName,
      });
      saveBlob(blob, filename);
    } catch (err) {
      onError(describe(err));
    } finally {
      setBusy(null);
    }
  };

  const row = (title: string, abstractOnly: boolean) => (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 text-sm text-gray-700">{title}</span>
      {(['xlsx', 'pdf', 'docx'] as const).map((format) => (
        <SecondaryButton
          key={format}
          onClick={() => void get(format, abstractOnly)}
          disabled={busy !== null}
        >
          {busy === `${format}-${abstractOnly}`
            ? 'Producing…'
            : format === 'xlsx'
            ? 'Excel'
            : format === 'pdf'
            ? 'PDF'
            : 'Word'}
        </SecondaryButton>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
      {row('Full bill', false)}
      {row(abstractName, true)}
      {(pkg.status === 'draft' ||
        pkg.status === 'pending_approval' ||
        pkg.status === 'approved') && (
        <p className="text-xs text-gray-500">
          Not yet issued — a download now is a draft copy, and its up-to-date
          column can still move.
        </p>
      )}
    </div>
  );
}

function ShareForm({
  pkg,
  busy,
  onSubmit,
}: {
  pkg: BillPackage;
  busy: boolean;
  onSubmit: (sharedTo: string) => void;
}) {
  const [sharedTo, setSharedTo] = useState(pkg.sharedTo ?? '');
  return (
    <form
      className="flex flex-wrap items-start gap-2 rounded-md bg-gray-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(sharedTo);
      }}
    >
      <div className="min-w-[18rem] flex-1">
        <TextField
          id="bill-shared-to"
          label={`Sent to the ${pkg.direction === 'to_client' ? 'client' : 'subcontractor'} — who, and how`}
          hint="For example: accounts@pwd.gov.in by email; hard copy to the site office"
          value={sharedTo}
          maxLength={500}
          onChange={(e) => setSharedTo(e.target.value)}
        />
      </div>
      <div className="shrink-0">
        <FieldLabelSpacer />
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Record as shared'}
        </Button>
      </div>
    </form>
  );
}

function CertifyForm({
  pkg,
  abstract,
  busy,
  onSubmit,
}: {
  pkg: BillPackage;
  abstract: BillAbstract | undefined;
  busy: boolean;
  onSubmit: (input: {
    certifiedAmount: string;
    remarks?: string;
    certificateData?: string;
    certificateFileName?: string;
  }) => void;
}) {
  const toClient = pkg.direction === 'to_client';
  // A client certifies the value of work done; the company certifies what it will pay a
  // subcontractor. Prefilled with the bill's own figure, which is the usual answer.
  const prefill =
    pkg.certifiedAmount ??
    (toClient
      ? abstract?.columns.thisBill.workDone
      : abstract?.columns.thisBill.payable) ??
    '';
  const [amount, setAmount] = useState(prefill);
  const [remarks, setRemarks] = useState(pkg.certifiedRemarks ?? '');
  const [certificate, setCertificate] = useState<File | null>(null);
  return (
    <form
      className="flex flex-wrap items-start gap-2 rounded-md bg-gray-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        onSubmit({
          certifiedAmount: amount.trim(),
          remarks: remarks.trim() || undefined,
          ...(certificate
            ? {
                certificateData: await toBase64(certificate),
                certificateFileName: certificate.name,
              }
            : {}),
        });
      }}
    >
      <div className="w-48">
        <TextField
          id="bill-certified-amount"
          label={toClient ? 'Value of work certified (₹)' : 'Payable certified (₹)'}
          inputMode="decimal"
          required
          pattern="^-?[0-9]+(\.[0-9]{1,2})?$"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="min-w-[16rem] flex-1">
        <TextField
          id="bill-certified-remarks"
          label="Remarks"
          hint={toClient ? 'Who certified it, and where — MB page, certificate number' : 'Optional'}
          value={remarks}
          maxLength={1000}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
      {/* Both directions (2026-10-14). On a subcontractor's bill this is the certified copy —
          filed as the RA bill's signed copy, which also acknowledges the bill. */}
      <div className="flex flex-col gap-1">
        <label htmlFor="bill-certificate" className="text-sm font-medium text-gray-700">
          {toClient ? 'Client’s certificate' : 'Certified copy'}
        </label>
        <input
          id="bill-certificate"
          type="file"
          accept="application/pdf,image/*,.xlsx,.xls"
          className="text-sm"
          onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="shrink-0">
        <FieldLabelSpacer />
        <Button type="submit" disabled={busy || !amount.trim()}>
          {busy ? 'Saving…' : 'Certify'}
        </Button>
      </div>
      <p className="w-full text-xs text-gray-500">
        Kept beside the billed figure, never instead of it — the difference is
        what gets chased.
        {!toClient &&
          ' Certifying releases the bill for payment; each payment can then produce a payment advice.'}
      </p>
    </form>
  );
}

function ReviseForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <form
      className="flex flex-wrap items-start gap-2 rounded-md bg-gray-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(reason.trim());
      }}
    >
      <div className="min-w-[18rem] flex-1">
        <TextField
          id="bill-revision-reason"
          label="Why is this bill being revised?"
          hint="Recorded against the bill with a count. It does not reopen the bill — what was sent stays readable."
          value={reason}
          required
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="shrink-0">
        <FieldLabelSpacer />
        <Button type="submit" disabled={busy || !reason.trim()}>
          {busy ? 'Saving…' : 'Record revision'}
        </Button>
      </div>
    </form>
  );
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function describe(err: unknown): string {
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
