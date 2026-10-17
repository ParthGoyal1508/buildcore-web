'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { submitPayrollRunForApproval } from '@/app/lib/api/hr-payroll';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * Shown under the bank sheet's refusal for a run that was never put into its approval chain
 * (2026-10-17): a run processed by hand before processing submitted it. One click submits it; the
 * bank sheet is then produced once the approvers have approved it under Approvals.
 */
export default function SubmitRunApproval({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => submitPayrollRunForApproval(runId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Could not submit the run for approval.',
      ),
  });

  if (submit.isSuccess) {
    return (
      <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
        Submitted for approval. Once every level has approved it under Approvals, the bank sheet
        can be produced.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SecondaryButton
        type="button"
        disabled={submit.isPending}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? 'Submitting…' : 'Submit for approval'}
      </SecondaryButton>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
