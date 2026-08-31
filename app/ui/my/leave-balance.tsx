'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getLeaveBalance, type LeaveBalance } from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { SelectField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

export const LEAVE_TYPE_LABEL: Record<LeaveBalance['leaveType'], string> = {
  earned: 'Earned',
  casual: 'Casual',
  sick: 'Sick',
  lwp: 'Leave Without Pay',
};

/**
 * The Indian financial year containing a date — April to March.
 *
 * Shared with the apply form so both screens agree on which year an application
 * counts against; a mismatch would show a balance from one year while spending
 * from another.
 */
export function financialYearOf(date: Date): string {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** This year and the two before it — far enough back to check a carried-over
 * balance, without a dropdown that grows forever. */
function recentFinancialYears(): string[] {
  const now = new Date();
  return [0, 1, 2].map((back) =>
    financialYearOf(new Date(now.getFullYear() - back, now.getMonth(), 1)),
  );
}

export default function LeaveBalancePanel() {
  const [financialYear, setFinancialYear] = useState(() =>
    financialYearOf(new Date()),
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'leave-balance', financialYear],
    queryFn: () => getLeaveBalance(financialYear),
  });

  const columns: Column<LeaveBalance>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => LEAVE_TYPE_LABEL[row.leaveType],
    },
    { key: 'opening', header: 'Opening', render: (row) => row.opening },
    { key: 'accrued', header: 'Accrued', render: (row) => row.accrued },
    { key: 'used', header: 'Used', render: (row) => row.used },
    {
      key: 'balance',
      header: 'Balance',
      render: (row) => (
        <span className="font-medium text-gray-900">{row.balance}</span>
      ),
    },
  ];

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-medium text-gray-900">Leave balance</h2>
        <SelectField
          id="financial-year"
          label="Financial year"
          value={financialYear}
          onChange={(event) => setFinancialYear(event.target.value)}
        >
          {recentFinancialYears().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.leaveType}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No leave entitlement recorded for this year."
      />
    </section>
  );
}
