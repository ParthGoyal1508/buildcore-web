'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  JOB_CARD_CHECKS,
  JOB_CARD_CONDITIONS,
  JOB_CARD_PRIORITIES,
  JOB_CARD_RESULTS,
  JOB_CARD_STATUSES,
  JOB_CARD_TYPES,
  createJobWithCard,
  downloadJobCard,
  getJobCard,
  getJobCardPrefill,
  isJobCardEditable,
  saveJobCard,
  saveJobCardQuotation,
  submitJobCard,
  type JobCard,
  type JobCardView,
} from '@/app/lib/api/plant-hire';
import { MESSAGES } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { Button, TextButton } from '@/app/ui/button';
import { LoadingText } from '@/app/ui/spinner';
import Modal from '@/app/ui/settings/modal';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
  fieldClass,
} from '@/app/ui/settings/form-fields';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import { useToast } from '@/app/ui/toast';
import DocumentDownloads from './document-downloads';
import {
  JobCardHistory,
  JobCardStatusBadge,
  finalBillLoader,
  quotationLoader,
  useOpenFile,
} from './job-card-flow';
import { EquipmentPicker } from './pickers';
import { dateLabel, todayIso } from '@/app/lib/format';

/** The card's single-value fields, held as strings while editing. */
const TEXT_FIELDS = [
  'date',
  'priority',
  'jobType',
  'department',
  'requestedBy',
  'location',
  'contact',
  'machineName',
  'assetNo',
  'registrationNo',
  'makeModel',
  'meterReading',
  'fuelLevel',
  'operator',
  'remarks',
  'complaint',
  'machineCondition',
  'breakdownStart',
  'reportedTo',
  'testResult',
  'outstandingWork',
  'machineStatus',
  'downTimeHours',
  'nextServiceDate',
  'nextServiceReading',
] as const;
type TextKey = (typeof TEXT_FIELDS)[number];

/** What `prefill` fills from the machine — overwritten each time a machine is picked. */
const MACHINE_FIELDS = [
  'machineName',
  'assetNo',
  'registrationNo',
  'makeModel',
  'meterReading',
  'operator',
  'location',
] as const;

interface InspectionDraft {
  key: number;
  fault: string;
  action: string;
  quotationAmount: string;
  startTime: string;
  finishTime: string;
}
interface PartDraft {
  key: number;
  description: string;
  partNo: string;
  quantity: string;
  unit: string;
  rate: string;
}
const SIGN_OFF = [
  ['operator', 'Operator / Driver'],
  ['technician', 'Mechanic / Technician'],
  ['supervisor', 'Supervisor'],
  ['incharge', 'Plant In-charge'],
] as const;
type SignOffKey = (typeof SIGN_OFF)[number][0];

let nextKey = 1;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const blankInspection = (): InspectionDraft => ({
  key: nextKey++,
  fault: '',
  action: '',
  quotationAmount: '',
  startTime: '',
  finishTime: '',
});
const blankPart = (): PartDraft => ({
  key: nextKey++,
  description: '',
  partNo: '',
  quantity: '',
  unit: '',
  rate: '',
});

/** Text if any, else absent — an enum the API validates must never arrive as `''`. */
const opt = (v: string) => (v.trim() === '' ? undefined : v.trim());
const optNum = (v: string) => (v.trim() === '' ? undefined : Number(v));

function TextAreaField({
  id,
  label,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <textarea id={id} rows={2} {...rest} className={fieldClass} />
    </div>
  );
}

/** One of the format's six numbered sections. */
function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200">
      <h3 className="rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 sm:px-4">
        {n}. {title}
      </h3>
      <div className="flex flex-col gap-4 p-3 sm:p-4">{children}</div>
    </section>
  );
}

/**
 * The Maintenance Job Card in the client's format (2026-10-15) — for a new job, or the card
 * of an existing one.
 *
 * Laid out as the format's six sections so the person filling it in can hold the paper card
 * beside the screen. Section 1's equipment details are filled from the machine the moment one
 * is picked (`prefill`), and stay editable: the card records what the mechanic saw, which is
 * not always what the register says. Everything else is entered by hand.
 *
 * A new card *opens the job*: the API creates it, puts the machine under maintenance and
 * numbers the card (JC-0001…) in one call. The job's type follows the card's priority —
 * Breakdown or Urgent is a breakdown, Routine is scheduled — and its description is the
 * complaint, which is why the complaint is required here and nowhere else. After that first
 * save the modal reopens on the saved card, so its number and downloads are there at once.
 */
export default function JobCardModal({
  jobId,
  onClose,
  onCreated,
}: {
  jobId: string | null;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}) {
  const existing = useQuery({
    queryKey: ['plant', 'job-card', jobId],
    queryFn: () => getJobCard(jobId as string),
    enabled: jobId !== null,
  });

  if (jobId !== null && !existing.data) {
    return (
      <Modal title="Job card" onClose={onClose} wide>
        {existing.isError ? (
          <FormError message={MESSAGES.plantLoadFailed} />
        ) : (
          <p className="text-sm text-gray-500" role="status">
            <LoadingText />
          </p>
        )}
      </Modal>
    );
  }

  return (
    <JobCardForm
      view={existing.data ?? null}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function JobCardForm({
  view,
  onClose,
  onCreated,
}: {
  view: JobCardView | null;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}) {
  const queryClient = useQueryClient();
  const isNew = view === null;
  const card = view?.card;

  const [equipmentId, setEquipmentId] = useState(view?.equipmentId ?? '');
  const [values, setValues] = useState<Record<TextKey, string>>(() => {
    const initial = Object.fromEntries(
      TEXT_FIELDS.map((key) => [key, str(card?.[key])]),
    ) as Record<TextKey, string>;
    if (!initial.date) initial.date = todayIso();
    return initial;
  });
  const [inspections, setInspections] = useState<InspectionDraft[]>(() =>
    card?.inspections?.length
      ? card.inspections.map((row) => ({
          key: nextKey++,
          fault: str(row.fault),
          action: str(row.action),
          quotationAmount: str(row.quotationAmount),
          startTime: str(row.startTime),
          finishTime: str(row.finishTime),
        }))
      : [blankInspection()],
  );
  const [parts, setParts] = useState<PartDraft[]>(() =>
    card?.parts?.length
      ? card.parts.map((row) => ({
          key: nextKey++,
          description: str(row.description),
          partNo: str(row.partNo),
          quantity: str(row.quantity),
          unit: str(row.unit),
          rate: str(row.rate),
        }))
      : [blankPart()],
  );
  const [checks, setChecks] = useState<string[]>(card?.checks ?? []);
  const [signOff, setSignOff] = useState<Record<SignOffKey, string>>({
    operator: str(card?.signOff?.operator),
    technician: str(card?.signOff?.technician),
    supervisor: str(card?.signOff?.supervisor),
    incharge: str(card?.signOff?.incharge),
  });
  const [projectHeading, setProjectHeading] = useState(
    view?.projectHeading ?? null,
  );
  const [prefilling, setPrefilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const openFile = useOpenFile(setError);

  // 039: the card's workflow. Site changes it only while it is a draft or sent back for
  // correction; after that it is Head Office's to decide and pay, and the form is read-only.
  const workflow = view?.workflow ?? null;
  const readOnly = !isJobCardEditable(workflow?.status);
  const initialQuotation = str(workflow?.quotation.amount);
  const [quotationAmount, setQuotationAmount] = useState(initialQuotation);
  const [quotationFile, setQuotationFile] = useState<PreparedFile | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const bind = (key: TextKey) => ({
    value: values[key],
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => setValues((prev) => ({ ...prev, [key]: event.target.value })),
  });

  async function pickMachine(id: string) {
    setEquipmentId(id);
    if (!id) return;
    setPrefilling(true);
    try {
      const prefill = await queryClient.fetchQuery({
        queryKey: ['plant', 'job-card-prefill', id],
        queryFn: () => getJobCardPrefill(id),
      });
      setProjectHeading(prefill.projectHeading);
      setValues((prev) => {
        const next = { ...prev };
        for (const key of MACHINE_FIELDS) next[key] = str(prefill.card[key]);
        return next;
      });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not read that machine’s details. Fill them in by hand.',
      );
    } finally {
      setPrefilling(false);
    }
  }

  function toCard(): JobCard {
    const text = Object.fromEntries(
      TEXT_FIELDS.filter((key) => key !== 'downTimeHours').map((key) => [
        key,
        opt(values[key]),
      ]),
    );
    const signed = Object.fromEntries(
      SIGN_OFF.map(([key]) => [key, opt(signOff[key])]),
    );
    return {
      ...text,
      downTimeHours: optNum(values.downTimeHours),
      // Blank rows are the form's spare line, not something the card should print.
      inspections: inspections
        .filter((r) => r.fault || r.action || r.quotationAmount)
        .map((r) => ({
          fault: opt(r.fault),
          action: opt(r.action),
          quotationAmount: optNum(r.quotationAmount),
          startTime: opt(r.startTime),
          finishTime: opt(r.finishTime),
        })),
      parts: parts
        .filter((r) => r.description || r.partNo)
        .map((r) => ({
          description: opt(r.description),
          partNo: opt(r.partNo),
          quantity: optNum(r.quantity),
          unit: opt(r.unit),
          rate: optNum(r.rate),
        })),
      checks,
      signOff: signed,
    };
  }

  /** Saves the card, then the quotation if it changed; `submit` then sends it to Head Office. */
  const save = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      const body = toCard();
      const amount = quotationAmount.trim();
      if (quotationFile && !amount) {
        throw new Error('Enter the quotation amount for the uploaded quotation.');
      }
      if (submit && (!amount || !(quotationFile || workflow?.quotation.hasFile))) {
        throw new Error(
          'Upload the workshop quotation and enter its amount before submitting to Head Office.',
        );
      }
      let jobId = view?.jobId ?? null;
      if (jobId) {
        await saveJobCard(jobId, body);
      } else {
        const job = await createJobWithCard({
          equipmentId,
          type:
            values.priority === 'Routine' || values.priority === ''
              ? 'scheduled'
              : 'breakdown',
          description: values.complaint.trim(),
          card: body,
        });
        jobId = job.id;
      }
      if (amount && (quotationFile || amount !== initialQuotation)) {
        await saveJobCardQuotation(jobId, {
          amount: Number(amount),
          file: quotationFile?.base64,
          fileName: quotationFile?.fileName,
        });
      }
      if (submit) await submitJobCard(jobId);
      return { jobId, submit };
    },
    onSuccess: ({ jobId: savedJobId, submit }) => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      if (submit) {
        toast.success(
          workflow?.status === 'returned'
            ? 'Resubmitted to Head Office.'
            : 'Sent to Head Office for approval.',
        );
        onClose();
      } else if (isNew) onCreated(savedJobId);
      else onClose();
    },
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : MESSAGES.plantSaveFailed,
      ),
  });

  const patchInspection = (key: number, patch: Partial<InspectionDraft>) =>
    setInspections((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  const patchPart = (key: number, patch: Partial<PartDraft>) =>
    setParts((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const meterLabel = values.meterReading.includes('km')
    ? 'Odometer'
    : 'Hour meter / odometer';

  return (
    <Modal
      title={
        isNew
          ? 'New maintenance job card'
          : `Job card ${view.jobCardNo ?? '(not yet numbered)'}`
      }
      onClose={onClose}
      wide
      footer={
        <>
          {view?.jobId && (
            <div className="flex flex-wrap gap-1.5 sm:mr-auto">
              <DocumentDownloads
                load={(format) =>
                  downloadJobCard(view.jobId as string, view.jobCardNo, format)
                }
                onError={setError}
              />
            </div>
          )}
          <SecondaryButton type="button" onClick={onClose}>
            {isNew ? 'Cancel' : 'Close'}
          </SecondaryButton>
          {!readOnly && (
            <>
              <Button
                type="submit"
                form="job-card-form"
                disabled={save.isPending || prefilling}
              >
                {save.isPending ? 'Saving…' : isNew ? 'Open job & save' : 'Save'}
              </Button>
              <Button
                type="button"
                disabled={save.isPending || prefilling}
                onClick={() => {
                  setError(null);
                  const form = document.getElementById(
                    'job-card-form',
                  ) as HTMLFormElement | null;
                  if (form && !form.reportValidity()) return;
                  save.mutate({ submit: true });
                }}
              >
                {workflow?.status === 'returned'
                  ? 'Save & resubmit'
                  : 'Save & submit for approval'}
              </Button>
            </>
          )}
        </>
      }
    >
      <form
        id="job-card-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate({ submit: false });
        }}
      >
        <FormError message={error} />
        {workflow && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">Status</span>
            <JobCardStatusBadge status={workflow.status} />
            <TextButton onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? 'Hide history' : 'History'}
            </TextButton>
          </div>
        )}
        {workflow?.returnRemarks &&
          (workflow.status === 'returned' || workflow.status === 'draft') && (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p className="font-medium">
                {workflow.status === 'returned'
                  ? 'Head Office sent this card back for correction'
                  : 'Head Office rejected this card'}
              </p>
              <p className="mt-1 whitespace-pre-line">{workflow.returnRemarks}</p>
            </div>
          )}
        {showHistory && view?.jobId && (
          <section className="rounded-lg border border-gray-200 p-3 sm:p-4">
            <JobCardHistory jobId={view.jobId} />
          </section>
        )}
        {readOnly && workflow && (
          <p className="text-xs text-gray-500">
            {workflow.status === 'pending_approval'
              ? 'With Head Office for approval — the card cannot be changed until they decide.'
              : 'Approved by Head Office — the card can no longer be changed.'}
          </p>
        )}
        {!isNew && !readOnly && (
          <p className="text-xs text-gray-500">
            Downloads print the card as last saved — save your changes first.
          </p>
        )}

        <section className="rounded-lg border border-gray-200">
          <h3 className="rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 sm:px-4">
            Workshop quotation{' '}
            <span className="font-normal text-gray-500">— required to submit</span>
          </h3>
          <div className="flex flex-col gap-4 p-3 sm:p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="jc-quotation-amount"
                label="Quotation amount (₹)"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                disabled={readOnly}
                value={quotationAmount}
                onChange={(event) => setQuotationAmount(event.target.value)}
              />
              {workflow?.quotation.hasFile && view?.jobId && (
                <div className="flex items-end">
                  <TextButton
                    onClick={() =>
                      void openFile(
                        quotationLoader(view.jobId as string),
                        workflow.quotation.fileName ?? 'quotation',
                      )
                    }
                  >
                    Open quotation{workflow.quotation.fileName ? ` (${workflow.quotation.fileName})` : ''}
                  </TextButton>
                </div>
              )}
            </div>
            {!readOnly && (
              <FileUpload
                label={workflow?.quotation.hasFile ? 'Replace quotation' : 'Quotation file'}
                hint="The workshop’s quotation — PDF or photo."
                onSelect={setQuotationFile}
              />
            )}
            {workflow?.finalBill && view?.jobId && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-3 text-sm text-gray-700">
                <span className="font-medium text-gray-900">Final bill</span>
                <span>
                  {workflow.finalBill.billNumber} · {dateLabel(workflow.finalBill.billDate)} ·{' '}
                  {workflow.finalBill.amount === null ? '—' : formatRupees(workflow.finalBill.amount)}
                </span>
                <span className="text-gray-500">
                  Paid {formatRupees(workflow.paidTotal)}
                  {workflow.balance !== null ? ` · balance ${formatRupees(workflow.balance)}` : ''}
                </span>
                <TextButton
                  onClick={() =>
                    void openFile(
                      finalBillLoader(view.jobId as string),
                      workflow.finalBill?.fileName ?? 'final-bill',
                    )
                  }
                >
                  Open bill
                </TextButton>
              </div>
            )}
          </div>
        </section>

        <fieldset disabled={readOnly} className="contents">

        <Section n={1} title="Job Card & Equipment Details">
          <EquipmentPicker
            id="jc-equipment"
            label="Machine"
            required
            disabled={!isNew}
            value={equipmentId}
            emptyLabel="Select a machine"
            selectedOption={
              equipmentId && card
                ? {
                    id: equipmentId,
                    label: card.assetNo || card.machineName || 'Machine',
                    sublabel: (card.assetNo && card.machineName) || undefined,
                  }
                : null
            }
            // A machine already under maintenance has an open job and the API refuses a second
            // (409), so a new card offers only the others.
            filterRow={
              isNew ? (row) => row.status !== 'under_maintenance' : undefined
            }
            onChange={(id) => void pickMachine(id)}
            hint={
              isNew
                ? prefilling
                  ? 'Reading the machine’s details…'
                  : 'Picking a machine fills its details below. Saving opens a maintenance job on it.'
                : undefined
            }
          />
          {projectHeading && (
            <p className="text-xs text-gray-500">
              Printed under the project heading:{' '}
              <span className="text-gray-700">{projectHeading}</span>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="jc-date"
              label="Date"
              type="date"
              {...bind('date')}
            />
            <SelectField
              id="jc-priority"
              label="Priority"
              {...bind('priority')}
            >
              <option value="">—</option>
              {JOB_CARD_PRIORITIES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectField>
            <SelectField id="jc-type" label="Job type" {...bind('jobType')}>
              <option value="">—</option>
              {JOB_CARD_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectField>
            <TextField
              id="jc-department"
              label="Department"
              maxLength={80}
              {...bind('department')}
            />
            <TextField
              id="jc-requested"
              label="Requested by"
              maxLength={80}
              {...bind('requestedBy')}
            />
            <TextField
              id="jc-contact"
              label="Contact"
              maxLength={40}
              {...bind('contact')}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="jc-machine-name"
              label="Machine name"
              maxLength={120}
              {...bind('machineName')}
            />
            <TextField
              id="jc-asset"
              label="Asset no."
              maxLength={40}
              {...bind('assetNo')}
            />
            <TextField
              id="jc-registration"
              label="Registration no."
              maxLength={40}
              {...bind('registrationNo')}
            />
            <TextField
              id="jc-make"
              label="Make / model"
              maxLength={120}
              {...bind('makeModel')}
            />
            <TextField
              id="jc-meter"
              label={meterLabel}
              maxLength={40}
              {...bind('meterReading')}
            />
            <TextField
              id="jc-fuel"
              label="Fuel level"
              maxLength={40}
              placeholder="e.g. 1/2"
              {...bind('fuelLevel')}
            />
            <TextField
              id="jc-operator"
              label="Operator / driver"
              maxLength={80}
              {...bind('operator')}
            />
            <TextField
              id="jc-location"
              label="Location"
              maxLength={120}
              {...bind('location')}
            />
          </div>
          <TextField
            id="jc-remarks"
            label="Remarks"
            maxLength={500}
            {...bind('remarks')}
          />
        </Section>

        <Section n={2} title="Complaint / Job Request">
          <TextAreaField
            id="jc-complaint"
            label="Complaint"
            required={isNew}
            maxLength={2000}
            {...bind('complaint')}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              id="jc-condition"
              label="Machine condition"
              {...bind('machineCondition')}
            >
              <option value="">—</option>
              {JOB_CARD_CONDITIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectField>
            <TextField
              id="jc-breakdown"
              label="Breakdown start"
              maxLength={40}
              placeholder="15.10.2026 09:30"
              {...bind('breakdownStart')}
            />
            <TextField
              id="jc-reported"
              label="Reported to"
              maxLength={80}
              {...bind('reportedTo')}
            />
          </div>
        </Section>

        <Section n={3} title="Inspection, Diagnosis & Work Carried Out">
          {inspections.map((row, index) => (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-md bg-gray-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Entry {index + 1}
                </span>
                {inspections.length > 1 && (
                  <RowAction
                    type="button"
                    onClick={() =>
                      setInspections((rows) =>
                        rows.filter((r) => r.key !== row.key),
                      )
                    }
                  >
                    Remove
                  </RowAction>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id={`jc-fault-${row.key}`}
                  label="Fault found"
                  maxLength={300}
                  value={row.fault}
                  onChange={(e) =>
                    patchInspection(row.key, { fault: e.target.value })
                  }
                />
                <TextField
                  id={`jc-action-${row.key}`}
                  label="Action taken"
                  maxLength={300}
                  value={row.action}
                  onChange={(e) =>
                    patchInspection(row.key, { action: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <TextField
                  id={`jc-quote-${row.key}`}
                  label="Quotation (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.quotationAmount}
                  onChange={(e) =>
                    patchInspection(row.key, {
                      quotationAmount: e.target.value,
                    })
                  }
                />
                <TextField
                  id={`jc-start-${row.key}`}
                  label="Start time"
                  type="time"
                  value={row.startTime}
                  onChange={(e) =>
                    patchInspection(row.key, { startTime: e.target.value })
                  }
                />
                <TextField
                  id={`jc-finish-${row.key}`}
                  label="Finish time"
                  type="time"
                  value={row.finishTime}
                  onChange={(e) =>
                    patchInspection(row.key, { finishTime: e.target.value })
                  }
                />
              </div>
            </div>
          ))}
          {inspections.length < 30 && (
            <div>
              <SecondaryButton
                type="button"
                onClick={() =>
                  setInspections((rows) => [...rows, blankInspection()])
                }
              >
                Add an entry
              </SecondaryButton>
            </div>
          )}
        </Section>

        <Section n={4} title="Spare Parts / Consumables Used">
          {view && view.storeParts.length > 0 && (
            <div className="rounded-md border border-gray-200">
              <p className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                Drawn from the spare-parts store against this job — printed on
                the card as recorded in the store, not edited here.
              </p>
              <ul className="divide-y divide-gray-100 text-sm">
                {view.storeParts.map((part, index) => (
                  <li
                    key={index}
                    className="flex flex-wrap justify-between gap-2 px-3 py-2"
                  >
                    <span>
                      {part.description}
                      {part.partNo ? ` · ${part.partNo}` : ''}
                    </span>
                    <span className="text-gray-600">
                      {part.quantity} {part.unit ?? ''} ×{' '}
                      {formatRupees(part.rate)} = {formatRupees(part.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parts.map((row, index) => (
            <div
              key={row.key}
              className="flex flex-col gap-3 rounded-md bg-gray-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Part {index + 1}
                </span>
                {parts.length > 1 && (
                  <RowAction
                    type="button"
                    onClick={() =>
                      setParts((rows) => rows.filter((r) => r.key !== row.key))
                    }
                  >
                    Remove
                  </RowAction>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <TextField
                  id={`jc-part-desc-${row.key}`}
                  label="Description"
                  maxLength={200}
                  value={row.description}
                  onChange={(e) =>
                    patchPart(row.key, { description: e.target.value })
                  }
                />
                <TextField
                  id={`jc-part-no-${row.key}`}
                  label="Part no."
                  maxLength={60}
                  value={row.partNo}
                  onChange={(e) =>
                    patchPart(row.key, { partNo: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <TextField
                  id={`jc-part-qty-${row.key}`}
                  label="Quantity"
                  type="number"
                  min={0}
                  step="0.001"
                  value={row.quantity}
                  onChange={(e) =>
                    patchPart(row.key, { quantity: e.target.value })
                  }
                />
                <TextField
                  id={`jc-part-unit-${row.key}`}
                  label="Unit"
                  maxLength={20}
                  placeholder="Nos"
                  value={row.unit}
                  onChange={(e) => patchPart(row.key, { unit: e.target.value })}
                />
                <TextField
                  id={`jc-part-rate-${row.key}`}
                  label="Rate (₹)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.rate}
                  onChange={(e) => patchPart(row.key, { rate: e.target.value })}
                />
                <div>
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Amount
                  </span>
                  <p className="min-h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
                    {row.quantity && row.rate
                      ? formatRupees(
                          Math.round(
                            Number(row.quantity) * Number(row.rate) * 100,
                          ) / 100,
                        )
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {parts.length < 50 && (
            <div>
              <SecondaryButton
                type="button"
                onClick={() => setParts((rows) => [...rows, blankPart()])}
              >
                Add a part
              </SecondaryButton>
            </div>
          )}
        </Section>

        <Section n={5} title="Testing, Safety & Handover">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">
              Checks done
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {JOB_CARD_CHECKS.map((check, index) => (
                <CheckboxField
                  key={check}
                  id={`jc-check-${index}`}
                  label={check}
                  checked={checks.includes(check)}
                  onChange={(event) =>
                    setChecks((prev) =>
                      event.target.checked
                        ? [...prev, check]
                        : prev.filter((c) => c !== check),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              id="jc-test"
              label="Test result"
              {...bind('testResult')}
            >
              <option value="">—</option>
              {JOB_CARD_RESULTS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="jc-status"
              label="Machine status"
              {...bind('machineStatus')}
            >
              <option value="">—</option>
              {JOB_CARD_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectField>
          </div>
          <TextAreaField
            id="jc-outstanding"
            label="Outstanding work"
            maxLength={1000}
            {...bind('outstandingWork')}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              id="jc-downtime"
              label="Down time (hours)"
              type="number"
              min={0}
              step="0.01"
              {...bind('downTimeHours')}
            />
            <TextField
              id="jc-next-date"
              label="Next service date"
              type="date"
              {...bind('nextServiceDate')}
            />
            <TextField
              id="jc-next-reading"
              label="Next service at (meter)"
              maxLength={40}
              {...bind('nextServiceReading')}
            />
          </div>
        </Section>

        <Section n={6} title="Approval & Sign-off">
          <div className="grid gap-4 sm:grid-cols-2">
            {SIGN_OFF.map(([key, label]) => (
              <TextField
                key={key}
                id={`jc-sign-${key}`}
                label={label}
                maxLength={80}
                value={signOff[key]}
                onChange={(event) =>
                  setSignOff((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
            ))}
          </div>
        </Section>
        </fieldset>
      </form>
    </Modal>
  );
}

