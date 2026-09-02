'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getQuarterlyTds } from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, MESSAGES } from '@/app/lib/constants';
import { financialYearOf, money, rupees } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

type Row = Awaited<ReturnType<typeof getQuarterlyTds>>['rows'][number];

/**
 * The quarterly TDS return (005 US14).
 *
 * Missing-PAN rows are flagged prominently rather than left as an empty cell.
 * Without a PAN the employee is deducted at the higher no-PAN rate and the
 * quarterly return cannot be filed correctly for them — it is the one thing on
 * this screen that needs action before the filing deadline, so it is counted at
 * the top rather than left to be spotted by scanning a column.
 */
export default function QuarterlyTdsReport() {
  const [financialYear, setFinancialYear] = useState(financialYearOf());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'quarterlyTds', financialYear, quarter],
    queryFn: () => getQuarterlyTds(financialYear, quarter),
  });

  const rows = data?.rows ?? [];
  const missingPan = rows.filter((row) => row.missingPan || !row.pan);

  const columns: Column<Row>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.name ?? row.employeeCode ?? row.employeeId,
    },
    {
      key: 'pan',
      header: 'PAN',
      render: (row) =>
        row.pan ? (
          <span className="font-mono">{row.pan}</span>
        ) : (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Missing
          </span>
        ),
    },
    {
      key: 'tds',
      header: 'TDS deducted',
      numeric: true,
      render: (row) => money(row.tdsDeducted ?? null),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <TextField
          id="quarterly-fy"
          label="Financial year"
          value={financialYear}
          onChange={(event) => setFinancialYear(event.target.value)}
        />
        <SelectField
          id="quarterly-quarter"
          label="Quarter"
          value={quarter}
          onChange={(event) => setQuarter(Number(event.target.value) as 1 | 2 | 3 | 4)}
        >
          <option value={1}>Q1 (Apr–Jun)</option>
          <option value={2}>Q2 (Jul–Sep)</option>
          <option value={3}>Q3 (Oct–Dec)</option>
          <option value={4}>Q4 (Jan–Mar)</option>
        </SelectField>
      </div>

      {missingPan.length > 0 && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {missingPan.length} employee{missingPan.length === 1 ? ' has' : 's have'} no
          PAN on file. {HR_MESSAGES.missingPan}
        </p>
      )}

      <DataTable
        caption="Quarterly TDS"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.employeeId}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No TDS was deducted in this quarter."
      />

      {data?.total !== null && data?.total !== undefined && (
        <p className="text-sm text-gray-700">
          Total deducted this quarter: <strong>{rupees(data.total)}</strong>
        </p>
      )}
    </div>
  );
}
