'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  getWorker,
  transferWorker,
  updateWorker,
  type LabourGender,
  type Worker,
  type WorkerDetail,
  type WorkerUpdate,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { LABOUR_GENDER_LABELS, LABOUR_GENDERS } from '@/app/lib/constants';
import { dateLabel, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import WorkerDetailsFields, {
  EMPTY_WORKER_DETAILS,
  workerDetailsErrors,
  type WorkerDetailsValue,
} from '@/app/ui/labour/worker-details-fields';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { LoadingText } from '@/app/ui/spinner';

/** Ten digits, optionally after +91 / 0 — the same rule the API applies. */
const PHONE_PATTERN = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;

/**
 * Edits a worker's details (052). The labour code, site and face photos stay; a move between sites
 * is Transfer. Only changed fields are sent, so an edit never clears what it did not touch. A
 * payment sheet already generated keeps its figures — a gender, special rate or contractor change
 * applies to sheets generated (or drafts regenerated) after it.
 */
export function EditWorkerForm({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: (saved: WorkerDetail) => void;
}) {
  const detail = useQuery({
    queryKey: ['worker', worker.id],
    queryFn: () => getWorker(worker.id),
  });
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Modal
      title={`Edit ${worker.fullName} (${worker.labourCode})`}
      onClose={onClose}
      isDirty={dirty}
      pending={pending}
      wide
    >
      {detail.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : detail.isError ? (
        <FormError
          message={errorMessage(detail.error, 'Could not load this worker.')}
        />
      ) : (
        <EditWorkerFields
          detail={detail.data}
          onClose={onClose}
          onSaved={onSaved}
          onDirty={setDirty}
          onPending={setPending}
        />
      )}
    </Modal>
  );
}

function EditWorkerFields({
  detail,
  onClose,
  onSaved,
  onDirty,
  onPending,
}: {
  detail: WorkerDetail;
  onClose: () => void;
  onSaved: (saved: WorkerDetail) => void;
  onDirty: (dirty: boolean) => void;
  onPending: (pending: boolean) => void;
}) {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const canSetRate = user.data?.permissions.includes('LABOUR_APPROVE') ?? false;
  const today = todayIso();

  const [fullName, setFullName] = useState(detail.fullName);
  const [gender, setGender] = useState<LabourGender | ''>(detail.gender ?? '');
  const [fatherName, setFatherName] = useState(detail.fatherName ?? '');
  const [phone, setPhone] = useState(detail.phone ?? '');
  const [details, setDetails] = useState<WorkerDetailsValue>({
    ...EMPTY_WORKER_DETAILS,
    engagementType: detail.engagementType,
    contractorId: detail.contractorId ?? '',
    skillCategoryId: detail.skillCategoryId ?? '',
    dateOfBirth: detail.dateOfBirth ?? '',
    rateOverride:
      detail.rateOverride !== null ? String(detail.rateOverride) : '',
  });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailErrors = workerDetailsErrors(details, today);
  const errors = {
    fullName: !fullName.trim() ? 'Enter the name.' : undefined,
    gender: !gender
      ? 'Pick male or female — it decides the daily rate.'
      : undefined,
    phone:
      phone.trim() && !PHONE_PATTERN.test(phone.trim())
        ? 'A mobile number is 10 digits, optionally starting with +91.'
        : undefined,
    ...detailErrors,
  };
  const valid = Object.values(errors).every((e) => !e);

  // Only what changed goes to the server.
  const text = (v: string) => v.trim() || null;
  const changes: WorkerUpdate = {};
  if (fullName.trim() !== detail.fullName) changes.fullName = fullName.trim();
  if (gender && gender !== detail.gender) changes.gender = gender;
  if (text(fatherName) !== detail.fatherName)
    changes.fatherName = text(fatherName);
  if (text(phone) !== detail.phone) changes.phone = text(phone);
  if (details.engagementType !== detail.engagementType)
    changes.engagementType = details.engagementType;
  if (
    details.engagementType === 'contractor' &&
    details.contractorId !== (detail.contractorId ?? '')
  )
    changes.contractorId = details.contractorId;
  if (details.skillCategoryId !== (detail.skillCategoryId ?? ''))
    changes.skillCategoryId = details.skillCategoryId || null;
  if (details.dateOfBirth !== (detail.dateOfBirth ?? ''))
    changes.dateOfBirth = details.dateOfBirth || null;
  if (details.aadhaarCleared) changes.aadhaarNumber = null;
  else if (details.aadhaarNumber.trim())
    changes.aadhaarNumber = details.aadhaarNumber.trim();
  if (details.bankCleared) changes.bankAccount = null;
  else if (details.bankAccount.trim())
    changes.bankAccount = details.bankAccount.trim();
  if (canSetRate) {
    const rate = details.rateOverride.trim()
      ? Number(details.rateOverride.trim())
      : null;
    if (rate !== detail.rateOverride) changes.rateOverride = rate;
  }
  const dirty = Object.keys(changes).length > 0;
  const priceChange =
    'gender' in changes ||
    'rateOverride' in changes ||
    'engagementType' in changes ||
    'contractorId' in changes;

  const save = useMutation({
    mutationFn: () => updateWorker(detail.id, changes),
    onMutate: () => onPending(true),
    onSettled: () => onPending(false),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e, 'Could not save the changes.')),
  });

  return (
    <form
      className="space-y-4"
      noValidate
      onChange={() => onDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        setError(null);
        if (valid && dirty) save.mutate();
      }}
    >
      <FormError message={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          id="ew-name"
          label="Name"
          autoComplete="off"
          maxLength={120}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={touched ? errors.fullName : undefined}
        />
        <SelectField
          id="ew-gender"
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value as LabourGender)}
          error={touched ? errors.gender : undefined}
        >
          {!detail.gender && <option value="">Not set</option>}
          {LABOUR_GENDERS.map((g) => (
            <option key={g} value={g}>
              {LABOUR_GENDER_LABELS[g]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="ew-father"
          label="Father's name (optional)"
          autoComplete="off"
          maxLength={120}
          value={fatherName}
          onChange={(e) => setFatherName(e.target.value)}
        />
        <TextField
          id="ew-phone"
          label="Mobile number (optional)"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={16}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={touched ? errors.phone : undefined}
        />
      </div>
      <WorkerDetailsFields
        idPrefix="ew"
        value={details}
        onChange={(next) => {
          setDetails(next);
          onDirty(true);
        }}
        canSetRate={canSetRate}
        errors={touched ? detailErrors : {}}
        stored={{
          aadhaarNumber: detail.aadhaarNumber,
          bankAccount: detail.bankAccount,
        }}
        today={today}
      />
      {priceChange && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payment sheets already generated keep their figures and contractor.
          This change applies to sheets generated after it — regenerate a draft
          sheet to pick it up.
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <SecondaryButton
          type="button"
          onClick={onClose}
          disabled={save.isPending}
        >
          Cancel
        </SecondaryButton>
        <Button type="submit" disabled={!dirty} loading={save.isPending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

/**
 * Moves a worker to another site (052). From today they are punched at the new site; the days
 * already recorded stay with the old site's attendance and payment sheets.
 */
export function TransferWorkerForm({
  worker,
  sites,
  currentSiteName,
  onClose,
  onSaved,
}: {
  worker: Worker;
  sites: { id: string; name: string }[];
  currentSiteName: string;
  onClose: () => void;
  onSaved: (saved: WorkerDetail) => void;
}) {
  const [siteId, setSiteId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const options = sites.filter((s) => s.id !== worker.siteId);

  const mutation = useMutation({
    mutationFn: () =>
      transferWorker(worker.id, {
        siteId,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e, 'Could not move the worker.')),
  });

  return (
    <Modal
      title={`Transfer ${worker.fullName}`}
      onClose={onClose}
      isDirty={!!siteId || !!reason}
      pending={mutation.isPending}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!siteId}
            loading={mutation.isPending}
          >
            Transfer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <p className="text-sm text-gray-700">
          {worker.labourCode} · now at{' '}
          <span className="font-medium">{currentSiteName}</span>
        </p>
        <SelectField
          id="t-site"
          label="Move to site"
          required
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">Select a site…</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="t-reason"
          label="Reason (optional)"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="text-sm text-gray-600">
          From today ({dateLabel(todayIso())}) they are punched in at the new
          site, with the same code and face photos. Days already recorded stay
          on {currentSiteName}&apos;s attendance and payment sheets. They leave
          their gang.
        </p>
      </div>
    </Modal>
  );
}
