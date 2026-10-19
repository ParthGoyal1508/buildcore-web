'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type BgTender,
  createBgTender,
  updateBgTender,
} from '@/app/lib/api/bank-guarantees';
import { ApiError } from '@/app/lib/api/client';
import { MESSAGES } from '@/app/lib/constants';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { amountInput } from '@/app/ui/projects/bank-guarantee-parts';
import { searchProjects } from '@/app/ui/projects/pickers';
import {
  FieldLabel,
  FormError,
  SecondaryButton,
  TextField,
  fieldClass,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';

/**
 * Enter or edit a tender (037): the left half of the client's "TENDER BG DETAILS" row. Its
 * guarantees are added on the tender's own page.
 */
export default function BgTenderModal({
  tender,
  onClose,
  onSaved,
}: {
  tender: BgTender | null;
  onClose: () => void;
  onSaved?: (tender: BgTender) => void;
}) {
  const [workName, setWorkName] = useState(tender?.workName ?? '');
  const [departmentName, setDepartmentName] = useState(tender?.departmentName ?? '');
  const [tenderAmount, setTenderAmount] = useState(tender?.tenderAmount ?? '');
  const [projectId, setProjectId] = useState(tender?.projectId ?? '');
  const [remarks, setRemarks] = useState(tender?.remarks ?? '');
  const [errors, setErrors] = useState<{ workName?: string; departmentName?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const isDirty =
    workName !== (tender?.workName ?? '') ||
    departmentName !== (tender?.departmentName ?? '') ||
    tenderAmount !== (tender?.tenderAmount ?? '') ||
    projectId !== (tender?.projectId ?? '') ||
    remarks !== (tender?.remarks ?? '');

  const save = useMutation({
    mutationFn: () => {
      // `null` clears a field on edit; on create a blank is simply left out.
      const blank = tender ? null : undefined;
      const input = {
        workName: workName.trim(),
        departmentName: departmentName.trim(),
        tenderAmount: tenderAmount || blank,
        projectId: projectId || blank,
        remarks: remarks.trim() || blank,
      };
      return tender ? updateBgTender(tender.id, input) : createBgTender(input);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['projects', 'bank-guarantees'] });
      toast.success(tender ? 'Tender saved.' : 'Tender added.');
      onSaved?.(saved);
      onClose();
    },
    onError: (error) =>
      setServerError(error instanceof ApiError ? error.message : MESSAGES.saveFailed),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    const next = {
      workName: workName.trim() ? undefined : 'Work name is required.',
      departmentName: departmentName.trim() ? undefined : 'Department name is required.',
    };
    setErrors(next);
    if (next.workName || next.departmentName) return;
    save.mutate();
  }

  return (
    <Modal
      title={tender ? 'Edit tender' : 'Add tender'}
      onClose={onClose}
      isDirty={isDirty}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="bg-tender-form" loading={save.isPending}>
            {save.isPending ? 'Saving…' : tender ? 'Save' : 'Add tender'}
          </Button>
        </>
      }
    >
      <form id="bg-tender-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={serverError} />
        <div>
          <FieldLabel htmlFor="bg-work-name" label="Work name" required />
          <textarea
            id="bg-work-name"
            rows={3}
            value={workName}
            onChange={(e) => setWorkName(e.target.value)}
            aria-required
            aria-invalid={errors.workName ? true : undefined}
            aria-describedby={errors.workName ? 'bg-work-name-error' : undefined}
            className={fieldClass}
          />
          {errors.workName && (
            <p id="bg-work-name-error" className="mt-1 text-sm text-red-600">
              {errors.workName}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="bg-department"
            label="Department name"
            placeholder="e.g. NHAI DELHI"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            error={errors.departmentName}
            aria-required
          />
          <TextField
            id="bg-tender-amount"
            label="Tender amount (₹)"
            inputMode="decimal"
            value={tenderAmount}
            onChange={(e) => setTenderAmount(amountInput(e.target.value))}
            hint="Optional."
          />
        </div>
        <div>
          <FieldLabel htmlFor="bg-project" label="Project" />
          <AsyncSelect
            id="bg-project"
            value={projectId}
            onChange={(id) => setProjectId(id)}
            selectedOption={
              tender?.projectId && tender.projectName
                ? { id: tender.projectId, label: tender.projectName }
                : null
            }
            emptyLabel="Not linked to a project"
            placeholder="Search projects"
            cacheKey={['projects', 'portfolio', 'picker']}
            search={searchProjects}
            aria-describedby="bg-project-hint"
          />
          <p id="bg-project-hint" className="mt-1 text-xs text-gray-500">
            Optional — an EMD on a bid that was not won has no project.
          </p>
        </div>
        <TextField
          id="bg-tender-remarks"
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          hint="Optional."
        />
      </form>
    </Modal>
  );
}
