'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { submitPayrollRunForApproval } from '@/app/lib/api/hr-payroll';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * Sends a payroll run to the Director (039). Shown under a refusal — processing or the bank sheet —
 * for a run never sent, including one processed before 039 that never entered a chain. The bank
 * sheet is produced once the Director has approved it under Approvals.
 */
export default function SubmitRunApproval({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: () => submitPayrollRunForApproval(runId),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRun', runId] });
      void queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
    },
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status < 500
          ? e.message
          : 'Could not send the run to the Director.',
      ),
  });

  if (submit.isSuccess) {
    return (
      <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
        Sent to the Director. Once approved under Approvals, the run can be processed and its bank
        sheet produced.
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
        {submit.isPending ? 'Sending…' : 'Send to Director'}
      </SecondaryButton>
      {error && (
        <span role="alert" className="text-sm text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
