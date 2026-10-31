'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';

import { getContractorOptions, getSkillCategories } from '@/app/lib/api/labour';
import { ENGAGEMENT_TYPES } from '@/app/lib/constants';
import { TextButton } from '@/app/ui/button';
import {
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * The worker details beyond name, gender, father's name and mobile (052): engagement and
 * contractor, skill, date of birth, Aadhaar, bank account and the special daily rate. Shared by the
 * registration screen and the edit form, so the two can never disagree on a rule.
 */
export interface WorkerDetailsValue {
  engagementType: 'direct' | 'contractor';
  contractorId: string;
  skillCategoryId: string;
  dateOfBirth: string;
  /** A new value typed in. Blank keeps what is stored (on edit) or leaves it empty (on register). */
  aadhaarNumber: string;
  bankAccount: string;
  /** Set when "Remove" was pressed on a stored value (edit only). */
  aadhaarCleared: boolean;
  bankCleared: boolean;
  rateOverride: string;
}

export const EMPTY_WORKER_DETAILS: WorkerDetailsValue = {
  engagementType: 'direct',
  contractorId: '',
  skillCategoryId: '',
  dateOfBirth: '',
  aadhaarNumber: '',
  bankAccount: '',
  aadhaarCleared: false,
  bankCleared: false,
  rateOverride: '',
};

const ENGAGEMENT_LABELS: Record<WorkerDetailsValue['engagementType'], string> =
  {
    direct: 'Direct (paid in cash)',
    contractor: 'Through a contractor',
  };

const RATE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Field errors, by the API's rules. Empty when the details can be sent. */
export function workerDetailsErrors(
  value: WorkerDetailsValue,
  today: string,
): Partial<Record<'contractorId' | 'dateOfBirth' | 'rateOverride', string>> {
  const errors: Partial<
    Record<'contractorId' | 'dateOfBirth' | 'rateOverride', string>
  > = {};
  if (value.engagementType === 'contractor' && !value.contractorId) {
    errors.contractorId = 'Pick the contractor this labour works for.';
  }
  if (value.dateOfBirth && value.dateOfBirth > today) {
    errors.dateOfBirth = 'The date of birth cannot be in the future.';
  }
  const rate = value.rateOverride.trim();
  if (rate && (!RATE_PATTERN.test(rate) || Number(rate) <= 0)) {
    errors.rateOverride = 'Enter an amount above 0, with up to 2 decimals.';
  }
  return errors;
}

export default function WorkerDetailsFields({
  idPrefix,
  value,
  onChange,
  canSetRate,
  errors = {},
  stored,
  today,
}: {
  idPrefix: string;
  value: WorkerDetailsValue;
  onChange: (next: WorkerDetailsValue) => void;
  /** The special rate is the HR office's (LABOUR_APPROVE); others do not see the field. */
  canSetRate: boolean;
  errors?: ReturnType<typeof workerDetailsErrors>;
  /** On edit, the masked Aadhaar and bank account on record. */
  stored?: { aadhaarNumber: string | null; bankAccount: string | null };
  today: string;
}) {
  const set = (patch: Partial<WorkerDetailsValue>) =>
    onChange({ ...value, ...patch });

  const contractors = useQuery({
    queryKey: ['labour', 'contractor-options'],
    queryFn: getContractorOptions,
    enabled: value.engagementType === 'contractor',
  });
  const skills = useQuery({
    queryKey: ['labour', 'skill-categories'],
    queryFn: () => getSkillCategories(),
  });

  const labourContractors =
    contractors.data?.filter((c) => c.type === 'labour_contractor') ?? [];
  const otherVendors =
    contractors.data?.filter((c) => c.type !== 'labour_contractor') ?? [];

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-gray-700">
          Engagement
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ENGAGEMENT_TYPES.map((t) => (
            <label
              key={t}
              className={clsx(
                'flex h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-500',
                value.engagementType === t
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-gray-300 bg-white text-gray-700',
              )}
            >
              <input
                type="radio"
                name={`${idPrefix}-engagement`}
                value={t}
                checked={value.engagementType === t}
                onChange={() => set({ engagementType: t })}
                className="sr-only"
              />
              {ENGAGEMENT_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      {value.engagementType === 'contractor' && (
        <SelectField
          id={`${idPrefix}-contractor`}
          label="Contractor"
          value={value.contractorId}
          onChange={(e) => set({ contractorId: e.target.value })}
          error={errors.contractorId}
          hint={
            contractors.isError
              ? 'Could not load the contractors. Close and try again.'
              : contractors.data?.length === 0
                ? 'No active vendors yet. Add the contractor under Partners first.'
                : undefined
          }
        >
          <option value="">
            {contractors.isPending ? 'Loading…' : 'Select a contractor…'}
          </option>
          {labourContractors.length > 0 && (
            <optgroup label="Labour contractors">
              {labourContractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          {otherVendors.length > 0 && (
            <optgroup label="Other vendors">
              {otherVendors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </SelectField>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          id={`${idPrefix}-skill`}
          label="Skill (optional)"
          value={value.skillCategoryId}
          onChange={(e) => set({ skillCategoryId: e.target.value })}
        >
          <option value="">Not set</option>
          {skills.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id={`${idPrefix}-dob`}
          label="Date of birth (optional)"
          type="date"
          max={today}
          value={value.dateOfBirth}
          onChange={(e) => set({ dateOfBirth: e.target.value })}
          error={errors.dateOfBirth}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StoredPiiField
          id={`${idPrefix}-aadhaar`}
          label="Aadhaar number (optional)"
          inputMode="numeric"
          maxLength={20}
          storedMasked={stored?.aadhaarNumber ?? null}
          typed={value.aadhaarNumber}
          cleared={value.aadhaarCleared}
          onType={(v) => set({ aadhaarNumber: v })}
          onClear={(c) => set({ aadhaarCleared: c, aadhaarNumber: '' })}
        />
        <StoredPiiField
          id={`${idPrefix}-bank`}
          label="Bank account (optional)"
          inputMode="numeric"
          maxLength={40}
          storedMasked={stored?.bankAccount ?? null}
          typed={value.bankAccount}
          cleared={value.bankCleared}
          onType={(v) => set({ bankAccount: v })}
          onClear={(c) => set({ bankCleared: c, bankAccount: '' })}
        />
      </div>

      {canSetRate && (
        <TextField
          id={`${idPrefix}-rate`}
          label="Special daily rate, ₹ (optional)"
          inputMode="decimal"
          value={value.rateOverride}
          onChange={(e) => set({ rateOverride: e.target.value })}
          error={errors.rateOverride}
          hint="Leave blank to pay the site's male or female rate."
        />
      )}
    </div>
  );
}

/**
 * A masked PII value on record (052): the input starts empty and shows the masked value as a hint,
 * typing replaces it, and "Remove" clears it. The full number is never sent to the browser.
 */
function StoredPiiField({
  id,
  label,
  inputMode,
  maxLength,
  storedMasked,
  typed,
  cleared,
  onType,
  onClear,
}: {
  id: string;
  label: string;
  inputMode: 'numeric';
  maxLength: number;
  storedMasked: string | null;
  typed: string;
  cleared: boolean;
  onType: (value: string) => void;
  onClear: (cleared: boolean) => void;
}) {
  if (storedMasked && cleared) {
    return (
      <div>
        <p className="mb-1 block text-sm font-medium text-gray-700">{label}</p>
        <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-dashed border-gray-300 px-3 text-sm text-gray-500 sm:h-10">
          <span>Will be removed</span>
          <SecondaryButton type="button" onClick={() => onClear(false)}>
            Undo
          </SecondaryButton>
        </div>
      </div>
    );
  }
  return (
    <div>
      <TextField
        id={id}
        label={label}
        inputMode={inputMode}
        autoComplete="off"
        maxLength={maxLength}
        value={typed}
        placeholder={storedMasked ?? ''}
        onChange={(e) => onType(e.target.value)}
        hint={
          storedMasked
            ? `On record: ${storedMasked}. Type a new number to replace it.`
            : undefined
        }
      />
      {storedMasked && (
        <TextButton
          tone="danger"
          size="xs"
          className="mt-1"
          onClick={() => onClear(true)}
        >
          Remove
        </TextButton>
      )}
    </div>
  );
}
