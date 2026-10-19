'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  updateContractor,
  type Contractor,
  type ContractorRegistrationsInput,
} from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { Field, TextInput } from '@/app/ui/partners/form-controls';
import { useToast } from '@/app/ui/toast';

const FIELDS = [
  { key: 'licenceNumber', label: 'Labour licence number' },
  { key: 'pfRegistration', label: 'PF registration' },
  { key: 'esicRegistration', label: 'ESIC registration' },
  { key: 'bocwRegistration', label: 'BOCW registration' },
  { key: 'insurancePolicyNumber', label: 'Insurance policy number' },
] as const;

type Key = (typeof FIELDS)[number]['key'];

/**
 * Edit a contractor's registration numbers (036 N5, 2026-10-17).
 *
 * They could be entered when the profile was created and never again: `updateContractor`
 * existed in the api module and no screen called it, so a renewed labour licence or a
 * corrected PF code meant a database fix. Only changed fields are sent, and a field
 * cleared to blank is sent as `null`, which the API stores as "not recorded".
 */
export default function ContractorRegistrationsModal({
  contractor,
  onClose,
}: {
  contractor: Contractor;
  onClose: () => void;
}) {
  const initial = Object.fromEntries(
    FIELDS.map(({ key }) => [key, contractor[key] ?? '']),
  ) as Record<Key, string>;
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const changes: ContractorRegistrationsInput = {};
  for (const { key } of FIELDS) {
    const next = values[key].trim();
    if (next !== initial[key].trim()) changes[key] = next === '' ? null : next;
  }
  const isDirty = Object.keys(changes).length > 0;

  const mutation = useMutation({
    mutationFn: () => updateContractor(contractor.id, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['partners', 'contractor', contractor.id],
      });
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
      toast.success('Registrations saved.');
      onClose();
    },
    // What was typed stays in the form; only the banner changes.
    onError: (err: unknown) => setError(errorMessage(err, MESSAGES.saveFailed)),
  });

  return (
    <Modal
      title="Edit registrations"
      onClose={onClose}
      isDirty={isDirty}
      pending={mutation.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="contractor-registrations-form"
            disabled={!isDirty}
            loading={mutation.isPending}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="contractor-registrations-form"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          if (isDirty) mutation.mutate();
        }}
      >
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label }) => (
            <Field
              key={key}
              id={`reg-${key}`}
              label={label}
              hint={contractor[key] ? 'Clear it to mark it as not recorded.' : undefined}
            >
              <TextInput
                id={`reg-${key}`}
                maxLength={60}
                value={values[key]}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </Field>
          ))}
        </div>
      </form>
    </Modal>
  );
}
