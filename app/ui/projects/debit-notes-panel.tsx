'use client';

import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';

import {
  applyDebitNote,
  type DebitNote,
  type DebitRegister,
  previewDebitNote,
  raiseDebitNote,
  type RaiseDebitNoteInput,
} from '@/app/lib/api/bill-packages';
import { downloadDebitNote } from '@/app/lib/api/billing';
import { money as roundMoney, productRounded } from '@/app/lib/bill-totals';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
import { Button, TextButton } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import { describe } from '@/app/ui/projects/bill-lifecycle';
import { useProjectLock } from '@/app/ui/projects/project-lock-context';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { TABLE } from '@/app/ui/table';

const DENSE_TH = clsx(TABLE.th, '!px-3 !py-2');
const DENSE_TD = clsx(TABLE.td, '!px-3 !py-2');

type Viewer = (file: {
  title: string;
  fileName: string;
  load: () => Promise<{ blob: Blob; filename: string | null }>;
}) => Promise<void> | void;

/** "2026-27/001" cannot be a file name; the slash becomes a dash, as the server names it. */
const fileStem = (note: DebitNote) =>
  `Debit Note ${(note.noteNumber ?? 'draft').replace(/\//g, '-')}`;

/** The API sends Decimals as strings. The shared `rupees` puts the ₹ on (036 A20). */
const amount = (value: string) => rupees(Number(value));

/**
 * The debit notes on a subcontractor's bill (2026-10-15), in the client's DV-04 format.
 *
 * A note is raised against **this bill's work order** — which is what names the party, its GSTIN
 * and its vendor code on the document — so the form never asks who the subcontractor is. It lists
 * items; the server computes each amount, the work-done total, the GST and the net. Each note
 * downloads as PDF, Word or Excel, and is recovered on exactly one bill.
 */
export default function DebitNotesPanel({
  register,
  packageId,
  projectId,
  workOrderId,
  defaultTaxBasis,
  editable,
  view,
  onChanged,
  onNotice,
  onError,
}: {
  register: DebitRegister;
  packageId: string;
  projectId: string;
  workOrderId: string | null;
  defaultTaxBasis: string | null;
  editable: boolean;
  view: Viewer;
  onChanged: () => void;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [raising, setRaising] = useState(false);
  /** The note being recovered, for its button's spinner (036 Wave 3). */
  const [recovering, setRecovering] = useState<string | null>(null);
  // Raising a note is a write on the project, refused with a 423 while it is locked (036 Wave 3).
  const { isLocked } = useProjectLock();

  const download = (note: DebitNote, format: 'pdf' | 'docx' | 'xlsx') =>
    downloadDebitNote(note.id, format, `${fileStem(note)}.${format}`)
      .then(({ blob, filename }) => saveBlob(blob, filename))
      .catch((err: unknown) => onError(describe(err)));

  return (
    <section>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-gray-900">Debit notes</h3>
        {/* Raising changes no bill — only recovering does — so it is offered on any bill not yet
            issued. Not on an issued one: its notes are the notes as at issue, and a note raised
            now would vanish from it. */}
        {!register.asAtIssue && workOrderId && !isLocked && (
          <Button onClick={() => setRaising(true)}>Raise a debit note</Button>
        )}
      </div>
      <p className="mb-2 text-xs text-gray-500">
        {register.asAtIssue ? (
          <>
            This bill has been issued, so these are the notes{' '}
            <strong>as at issue</strong> — a note raised afterwards cannot
            change a document that has been signed.
          </>
        ) : (
          <>
            Notes raised on this subcontractor under this work order. Recover a
            note here to deduct it on this bill.
          </>
        )}{' '}
        Recovered on this bill: {amount(register.recoveredOnThisPackage)} of{' '}
        {amount(register.total)}.
      </p>

      {register.notes.length === 0 ? (
        <p className="text-sm text-gray-600">No debit notes yet.</p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={DENSE_TH}>Note</th>
                <th className={DENSE_TH}>Items</th>
                <th className={clsx(DENSE_TH, 'text-right')}>Net amount</th>
                <th className={DENSE_TH}>Recovery</th>
                <th className={DENSE_TH} />
              </tr>
            </thead>
            <tbody>
              {register.notes.map((note) => (
                <tr key={note.id} className={TABLE.row}>
                  <td className={DENSE_TD}>
                    <span className="block font-mono text-sm text-gray-900">
                      {note.noteNumber ?? '—'}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {dateLabel(note.noteDate)}
                      {note.natureOfWork ? ` · ${note.natureOfWork}` : ''}
                    </span>
                  </td>
                  <td className={clsx(DENSE_TD, 'text-xs text-gray-600')}>
                    {note.lines.map((line) => line.description).join(', ')}
                  </td>
                  <td className={clsx(DENSE_TD, 'text-right')}>
                    {amount(note.netAmount)}
                  </td>
                  <td className={clsx(DENSE_TD, 'text-xs text-gray-500')}>
                    {note.recoveredOn
                      ? `Recovered in ${note.recoveredOn}`
                      : 'Not yet recovered'}
                  </td>
                  <td className={clsx(DENSE_TD, 'text-right')} data-row-actions>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        intent="read"
                        onClick={() =>
                          void view({
                            title: note.noteNumber ?? 'Debit note',
                            fileName: `${fileStem(note)}.pdf`,
                            load: () =>
                              downloadDebitNote(
                                note.id,
                                'pdf',
                                `${fileStem(note)}.pdf`,
                              ),
                          })
                        }
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        intent="read"
                        onClick={() => void download(note, 'pdf')}
                      >
                        PDF
                      </Button>
                      <Button
                        type="button"
                        intent="read"
                        onClick={() => void download(note, 'docx')}
                      >
                        Word
                      </Button>
                      <Button
                        type="button"
                        intent="read"
                        onClick={() => void download(note, 'xlsx')}
                      >
                        Excel
                      </Button>
                      {/* A note is recovered on exactly one bill; the server refuses a second
                          application by name, so its refusal is shown rather than guessed at. */}
                      {editable && !note.recoveredOnPackageId && (
                        <Button
                          loading={recovering === note.id}
                          disabled={recovering !== null}
                          onClick={async () => {
                            // 036 Wave 3 (2026-10-18): asked first — a note is recovered on
                            // exactly one bill, so a stray click here spends it on this one.
                            const ok = await confirmDialog({
                              title: `Recover ${note.noteNumber ?? 'this note'} on this bill?`,
                              message: `${amount(note.netAmount)} comes off this bill's payable. A note is recovered on one bill only, so it cannot then be recovered on another.`,
                              confirmLabel: 'Recover here',
                              tone: 'default',
                            });
                            if (!ok) return;
                            setRecovering(note.id);
                            applyDebitNote(note.id, packageId)
                              .then(() => {
                                onNotice(
                                  'Recovered on this bill. It cannot be recovered on another.',
                                );
                                onChanged();
                              })
                              .catch((err: unknown) => onError(describe(err)))
                              .finally(() => setRecovering(null));
                          }}
                        >
                          Recover here
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {raising && workOrderId && (
        <RaiseDebitNote
          view={view}
          projectId={projectId}
          workOrderId={workOrderId}
          defaultTaxBasis={defaultTaxBasis}
          onClose={() => setRaising(false)}
          onDone={(note) => {
            setRaising(false);
            onNotice(`Debit note ${note.noteNumber ?? ''} raised.`.trim());
            onChanged();
          }}
        />
      )}
    </section>
  );
}

interface LineDraft {
  key: number;
  description: string;
  specification: string;
  unit: string;
  quantity: string;
  rate: string;
}

const blankLine = (key: number): LineDraft => ({
  key,
  description: '',
  specification: '',
  unit: '',
  quantity: '',
  rate: '',
});

const today = () => todayIso();

/**
 * The form behind "Raise a debit note" — the fields of the client's format that are not already on
 * record. The party, its GSTIN, its vendor code and the work order number come from the bill's work
 * order; the number is allocated on save.
 *
 * The amounts shown are a preview, quantity × rate; the server computes and stores the figures the
 * note prints, so what is saved never depends on this arithmetic.
 */
function RaiseDebitNote({
  view,
  projectId,
  workOrderId,
  defaultTaxBasis,
  onClose,
  onDone,
}: {
  view: Viewer;
  projectId: string;
  workOrderId: string;
  defaultTaxBasis: string | null;
  onClose: () => void;
  onDone: (note: DebitNote) => void;
}) {
  const [noteDate, setNoteDate] = useState(today());
  const [natureOfWork, setNatureOfWork] = useState('');
  const [gstPercent, setGstPercent] = useState('18');
  const [taxBasis, setTaxBasis] = useState<'intra_state' | 'inter_state'>(
    defaultTaxBasis === 'inter_state' ? 'inter_state' : 'intra_state',
  );
  const [lines, setLines] = useState<LineDraft[]>([blankLine(1)]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (key: number, patch: Partial<LineDraft>) =>
    setLines((all) =>
      all.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  /**
   * The preview's figures on `bill-totals.ts`'s decimal arithmetic (036 Wave 3, 2026-10-18): the
   * float `Math.round(q × r × 100) / 100` priced 10.05 × 0.5 at 5.02 where the server says 5.03.
   * Still a preview — the server computes what the note prints.
   */
  const amountOf = (line: LineDraft) =>
    line.quantity && line.rate
      ? productRounded(2, Number(line.quantity), Number(line.rate))
      : null;
  const workDone = roundMoney(
    lines.reduce((sum, line) => sum + (amountOf(line) ?? 0), 0),
  );
  const tax = productRounded(2, workDone, Number(gstPercent || 0), 0.01);

  /** What both Preview and Raise send — one shape, so the preview is the note that would be raised. */
  const input = (): RaiseDebitNoteInput => ({
    workOrderId,
    noteDate,
    ...(natureOfWork.trim() ? { natureOfWork: natureOfWork.trim() } : {}),
    gstPercent,
    taxBasis,
    lines: lines.map((line) => ({
      description: line.description.trim(),
      ...(line.specification.trim()
        ? { specification: line.specification.trim() }
        : {}),
      ...(line.unit.trim() ? { unit: line.unit.trim() } : {}),
      quantity: line.quantity,
      rate: line.rate,
    })),
  });

  const ready =
    lines.length > 0 &&
    lines.every(
      (line) =>
        line.description.trim() &&
        Number(line.quantity) > 0 &&
        line.rate !== '' &&
        Number(line.rate) >= 0,
    ) &&
    gstPercent !== '';

  return (
    <Modal
      title="Raise a debit note"
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          {/* The note exactly as it would print — the same computation as the raise, numbered
              "Draft" because nothing is saved until Raise. */}
          <Button
            type="button"
            intent="read"
            disabled={!ready}
            onClick={() =>
              void view({
                title: 'Debit note — preview',
                fileName: 'Debit Note (draft).pdf',
                load: () => previewDebitNote(projectId, input()),
              })
            }
          >
            Preview
          </Button>
          <Button
            type="submit"
            form="debit-note-form"
            disabled={!ready}
            loading={saving}
          >
            {saving ? 'Saving…' : 'Raise'}
          </Button>
        </>
      }
    >
      <form
        id="debit-note-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setError(null);
          raiseDebitNote(projectId, input())
            .then(onDone)
            .catch((err: unknown) => setError(describe(err)))
            .finally(() => setSaving(false));
        }}
      >
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="dn-date"
            label="Debit note date"
            type="date"
            required
            value={noteDate}
            onChange={(event) => setNoteDate(event.target.value)}
          />
          <TextField
            id="dn-nature"
            label="Nature of work"
            value={natureOfWork}
            onChange={(event) => setNatureOfWork(event.target.value)}
            placeholder="O&M of Highway"
            hint="Leave blank to use the work order’s description of the work."
            autoComplete="off"
          />
          <TextField
            id="dn-gst"
            label="GST %"
            type="number"
            min={0}
            step="0.01"
            required
            value={gstPercent}
            onChange={(event) => setGstPercent(event.target.value)}
          />
          <SelectField
            id="dn-tax"
            label="Tax"
            value={taxBasis}
            onChange={(event) =>
              setTaxBasis(event.target.value as 'intra_state' | 'inter_state')
            }
            hint="Defaults to this bill’s own tax basis."
          >
            <option value="intra_state">CGST + SGST (same state)</option>
            <option value="inter_state">IGST (other state)</option>
          </SelectField>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Items</p>
          <div className="flex flex-col gap-3">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-6">
                  <TextField
                    id={`dn-item-${line.key}`}
                    label={`Item ${index + 1} — name`}
                    required
                    autoComplete="off"
                    value={line.description}
                    onChange={(event) =>
                      update(line.key, { description: event.target.value })
                    }
                    placeholder="Solar Panel (335 W)"
                  />
                </div>
                <div className="sm:col-span-6">
                  <TextField
                    id={`dn-spec-${line.key}`}
                    label="Specification"
                    autoComplete="off"
                    value={line.specification}
                    onChange={(event) =>
                      update(line.key, { specification: event.target.value })
                    }
                    placeholder="7 Nos. water pump location"
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    id={`dn-unit-${line.key}`}
                    label="Unit"
                    autoComplete="off"
                    value={line.unit}
                    onChange={(event) =>
                      update(line.key, { unit: event.target.value })
                    }
                    placeholder="Nos."
                  />
                </div>
                <div className="sm:col-span-3">
                  <TextField
                    id={`dn-qty-${line.key}`}
                    label="Qty"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    value={line.quantity}
                    onChange={(event) =>
                      update(line.key, { quantity: event.target.value })
                    }
                  />
                </div>
                <div className="sm:col-span-3">
                  <TextField
                    id={`dn-rate-${line.key}`}
                    label="Rate (₹)"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    value={line.rate}
                    onChange={(event) =>
                      update(line.key, { rate: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-4">
                  <p className="pb-2 text-sm text-gray-700">
                    {amountOf(line) === null ? '—' : rupees(amountOf(line))}
                  </p>
                  {lines.length > 1 && (
                    <TextButton
                      tone="danger"
                      className="mb-1"
                      onClick={() =>
                        setLines((all) =>
                          all.filter((other) => other.key !== line.key),
                        )
                      }
                    >
                      <TrashIcon className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </TextButton>
                  )}
                </div>
              </div>
            ))}
          </div>
          <TextButton
            className="mt-2"
            onClick={() =>
              setLines((all) => [
                ...all,
                blankLine(Math.max(...all.map((line) => line.key)) + 1),
              ])
            }
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add an item
          </TextButton>
        </div>

        <dl className="grid gap-1 rounded-md bg-gray-50 px-3 py-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">Work done amount</dt>
            <dd className="font-medium text-gray-900">
              {rupees(workDone)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">
              {taxBasis === 'intra_state' ? 'CGST + SGST' : 'IGST'}
            </dt>
            <dd className="font-medium text-gray-900">
              {rupees(tax)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Net amount (approx.)</dt>
            <dd className="font-medium text-gray-900">
              {rupees(roundMoney(workDone + tax))}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500">
          The party, its GST number, its vendor code and the work order number
          come from this bill’s work order. The note number (e.g. 2026-27/001)
          and the final figures are set when it is saved.
        </p>
      </form>
    </Modal>
  );
}
