'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createCompliance, getContractors } from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';

/** `YYYY-MM` of the current month — the latest a filing can be recorded for. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function ComplianceModal({
  contractorId,
  onClose,
}: {
  contractorId?: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    contractorProfileId: contractorId ?? '',
    month: '',
    pfChallanNumber: '',
    pfAmount: '',
    pfDate: '',
    esicChallanNumber: '',
    esicAmount: '',
    esicDate: '',
  });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: contractors } = useQuery({
    queryKey: ['partners', 'contractors', ''],
    queryFn: () => getContractors(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      createCompliance({
        contractorProfileId: form.contractorProfileId,
        month: form.month,
        pfChallanNumber: form.pfChallanNumber || undefined,
        pfAmount: form.pfAmount ? Number(form.pfAmount) : undefined,
        pfDate: form.pfDate || undefined,
        esicChallanNumber: form.esicChallanNumber || undefined,
        esicAmount: form.esicAmount ? Number(form.esicAmount) : undefined,
        esicDate: form.esicDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners', 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
      onClose();
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  const set =
    (key: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal
      title="Record a monthly filing"
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="compliance-form" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="compliance-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (!form.contractorProfileId) return setError('Choose a contractor.');
          if (!form.month) return setError('Choose a month.');
          mutation.mutate();
        }}
      >
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="compliance-contractor" label="Contractor">
            <SelectInput
              id="compliance-contractor"
              value={form.contractorProfileId}
              onChange={set('contractorProfileId')}
            >
              <option value="">Select a contractor…</option>
              {(contractors ?? []).map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.vendorName} ({contractor.vendorCode})
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field
            id="compliance-month"
            label="Month"
            hint="A filing cannot be recorded for a month that has not happened."
          >
            <TextInput
              id="compliance-month"
              type="month"
              max={currentMonth()}
              value={form.month}
              onChange={set('month')}
            />
          </Field>
        </div>

        {/* PF and ESIC are independent: filing one without the other is a normal
            state, not an incomplete form, and the record's status says so. */}
        <fieldset className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">
            Provident fund
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="pf-challan" label="Challan number">
              <TextInput id="pf-challan" value={form.pfChallanNumber} onChange={set('pfChallanNumber')} />
            </Field>
            <Field id="pf-amount" label="Amount">
              <TextInput id="pf-amount" type="number" step="0.01" value={form.pfAmount} onChange={set('pfAmount')} />
            </Field>
            <Field id="pf-date" label="Paid on">
              <TextInput id="pf-date" type="date" value={form.pfDate} onChange={set('pfDate')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">ESIC</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="esic-challan" label="Challan number">
              <TextInput id="esic-challan" value={form.esicChallanNumber} onChange={set('esicChallanNumber')} />
            </Field>
            <Field id="esic-amount" label="Amount">
              <TextInput id="esic-amount" type="number" step="0.01" value={form.esicAmount} onChange={set('esicAmount')} />
            </Field>
            <Field id="esic-date" label="Paid on">
              <TextInput id="esic-date" type="date" value={form.esicDate} onChange={set('esicDate')} />
            </Field>
          </div>
        </fieldset>

        <p className="text-xs text-gray-500">
          Status is derived from what you record: both challans is “Submitted”, one is
          “Partial”, neither is “Missing”. Verification is a separate, deliberate step.
        </p>
      </form>
    </Modal>
  );
}
