'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadEmployeeSlipPdf,
  listEmployeeSlipPeriods,
} from '@/app/lib/api/hr-payroll';
import { saveBlob } from '@/app/lib/download-file';
import { periodLabel } from '@/app/lib/format';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';

/**
 * An employee's published payslips, from HR's side (2026-10-14).
 *
 * The same PDF the employee downloads from My Salary — company letterhead, one per period — reached
 * through `hr/payroll/employees/:id/slips`, which requires `PAYROLL`. The tab that mounts this is
 * shown only to holders of it, so a refusal here means the server disagreed, and it says so.
 */
export default function EmployeePayslips({ employeeId }: { employeeId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const periods = useQuery({
    queryKey: ['hr', 'payslips', employeeId],
    queryFn: () => listEmployeeSlipPeriods(employeeId),
  });

  const download = async (period: string) => {
    setError(null);
    setBusy(period);
    try {
      const file = await downloadEmployeeSlipPdf(employeeId, period);
      saveBlob(file.blob, file.filename ?? `payslip-${period}.pdf`);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code
          ? err.message
          : 'That payslip could not be downloaded.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (periods.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (periods.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {periods.error instanceof ApiError && periods.error.status === 403
          ? 'Payslips need the Payroll permission.'
          : 'The payslips could not be loaded.'}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="payslips-heading">
      <h3 id="payslips-heading" className="text-sm font-medium text-gray-900">
        Published payslips
      </h3>
      <FormError message={error} />
      {periods.data.length === 0 ? (
        <p className="rounded-lg border border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
          No payslip has been published for this employee yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {periods.data.map((period) => (
            <li key={period} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-gray-900">{periodLabel(period)}</span>
              <RowAction
                intent="read"
                type="button"
                disabled={busy === period}
                onClick={() => void download(period)}
              >
                {busy === period ? 'Downloading…' : 'Download PDF'}
              </RowAction>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
