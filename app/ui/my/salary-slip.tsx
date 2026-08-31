'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  downloadSalarySlipPdf,
  getAvailablePeriods,
  getSalarySlip,
  type SalarySlip as Slip,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { FormError, SelectField } from '@/app/ui/settings/form-fields';

const money = (value: number) =>
  value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** "2026-07" → "July 2026". The API's period key is a sort key, not something to
 * put in front of a person. */
function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function AmountRows({
  rows,
  total,
  totalLabel,
}: {
  rows: Array<[string, number]>;
  total: number;
  totalLabel: string;
}) {
  return (
    <dl className="text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-1">
          <dt className="text-gray-600">{label}</dt>
          <dd className="tabular-nums text-gray-900">{money(value)}</dd>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-gray-200 py-1 font-medium">
        <dt className="text-gray-700">{totalLabel}</dt>
        <dd className="tabular-nums text-gray-900">{money(total)}</dd>
      </div>
    </dl>
  );
}

export default function SalarySlipPanel() {
  const [chosenPeriod, setChosenPeriod] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    data: periods,
    isLoading: periodsLoading,
    isError: periodsError,
  } = useQuery({
    queryKey: ['my', 'salary-periods'],
    queryFn: getAvailablePeriods,
  });

  // Derived, not synced into state by an effect: the default is a pure function of
  // the periods that came back, and writing it into state would mean an extra
  // render and a moment where the dropdown and the fetched slip disagree. The
  // newest published period is what the employee almost always wants, so making
  // them pick it first would be a step with one sensible answer.
  const period = chosenPeriod ?? periods?.[0] ?? null;

  const { data: slip, isLoading: slipLoading } = useQuery({
    queryKey: ['my', 'salary', period],
    queryFn: () => getSalarySlip(period as string),
    enabled: period !== null,
  });

  async function download() {
    if (!period) return;
    setDownloadError(null);
    setIsDownloading(true);
    try {
      const blob = await downloadSalarySlipPdf(period);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip-${period}.pdf`;
      link.click();
      // Released after the click, not before: revoking synchronously can cancel the
      // download in some browsers before it has read the blob.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : MESSAGES.loadFailed,
      );
    } finally {
      setIsDownloading(false);
    }
  }

  if (periodsLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (periodsError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }
  // T030: an employee whose first payroll has not run yet, which is a normal state
  // and not an error.
  if (!periods || periods.length === 0) {
    return (
      <p className="rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-600">
        {MESSAGES.noSalaryPeriods}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <SelectField
        id="salary-period"
        label="Month"
        value={period ?? ''}
        onChange={(event) => setChosenPeriod(event.target.value)}
      >
        {periods.map((value) => (
          <option key={value} value={value}>
            {periodLabel(value)}
          </option>
        ))}
      </SelectField>

      <FormError message={downloadError} />

      {slipLoading && (
        <p className="text-sm text-gray-500" role="status">
          Loading payslip…
        </p>
      )}

      {slip && <SlipBody slip={slip} />}

      <Button type="button" onClick={download} disabled={isDownloading || !slip}>
        {isDownloading ? 'Preparing…' : 'Download PDF'}
      </Button>
    </div>
  );
}

function SlipBody({ slip }: { slip: Slip }) {
  return (
    <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[
          ['Month days', slip.monthDays],
          ['Payable days', slip.payableDays],
          ['LOP days', slip.lopDays],
          ['OT hours', slip.otHours],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {label}
            </dt>
            <dd className="text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-medium text-gray-900">Earnings</h3>
          <AmountRows
            totalLabel="Total earnings"
            total={slip.earnings.total}
            rows={[
              ['Basic', slip.earnings.basic],
              ['HRA', slip.earnings.hra],
              ['Conveyance', slip.earnings.conveyance],
              ['Site allowance', slip.earnings.siteAllowance],
              ['Special allowance', slip.earnings.specialAllowance],
              ['Overtime', slip.earnings.ot],
            ]}
          />
        </div>

        <div>
          <h3 className="mb-1 text-sm font-medium text-gray-900">Deductions</h3>
          <AmountRows
            totalLabel="Total deductions"
            total={slip.deductions.total}
            rows={[
              ['PF', slip.deductions.pf],
              ['ESIC', slip.deductions.esic],
              ['Professional tax', slip.deductions.pt],
              ['TDS', slip.deductions.tds],
              ['Loan EMI', slip.deductions.loanEmi],
              ['Advance recovery', slip.deductions.advanceRecovery],
            ]}
          />
        </div>
      </div>

      <div className="rounded-md bg-blue-50 px-3 py-3">
        <p className="text-lg font-semibold text-blue-900">
          Net pay: ₹{money(slip.netPay)}
        </p>
        <p className="text-xs text-blue-800">{slip.netPayInWords}</p>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-medium text-gray-900">
          Employer contributions
        </h3>
        {/* Labelled informational because they are not deducted from net pay, and
            an employee reading a column of numbers under their payslip will
            otherwise assume they were. */}
        <p className="mb-1 text-xs text-gray-500">
          Paid by your employer on top of your salary — not deducted from your net
          pay.
        </p>
        <AmountRows
          totalLabel="Total contributions"
          total={slip.employerContributions.total}
          rows={[
            ['PF', slip.employerContributions.pf],
            ['EPS', slip.employerContributions.eps],
            ['EDLI', slip.employerContributions.edli],
            ['Admin charges', slip.employerContributions.adminCharges],
            ['Gratuity', slip.employerContributions.gratuity],
            ['Bonus', slip.employerContributions.bonus],
          ]}
        />
      </div>

      {slip.minimumWagesNote && (
        <p className="text-xs text-gray-500">{slip.minimumWagesNote}</p>
      )}
    </div>
  );
}
