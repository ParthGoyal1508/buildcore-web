'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getFormSixteenData, listEmployees } from '@/app/lib/api/hr-payroll';
import { MESSAGES } from '@/app/lib/constants';
import { financialYearOf, rupees } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

type SectionRow = Awaited<
  ReturnType<typeof getFormSixteenData>
>['deductionsBySection'][number];

/**
 * The figures behind an employee's Form 16 Part B.
 *
 * Not the form itself — this is the computation, which is what payroll has to be
 * able to explain when an employee asks why their tax was what it was. Each
 * section shows declared *and* allowed side by side: the gap between them is the
 * usual answer, and a view showing only the allowed figure leaves the question
 * unanswered.
 */
export default function FormSixteenView() {
  const [employeeId, setEmployeeId] = useState('');
  const [financialYear, setFinancialYear] = useState(financialYearOf());

  const { data: employees } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'formSixteen', employeeId, financialYear],
    queryFn: () => getFormSixteenData(employeeId, financialYear),
    enabled: employeeId.length > 0,
  });

  const columns: Column<SectionRow>[] = [
    { key: 'section', header: 'Section', sticky: true, render: (row) => row.sectionCode },
    {
      key: 'declared',
      header: 'Declared',
      numeric: true,
      render: (row) => rupees(row.declaredAmount),
    },
    {
      key: 'allowed',
      header: 'Allowed',
      numeric: true,
      render: (row) => (
        <span className={row.allowedAmount < row.declaredAmount ? 'text-amber-700' : undefined}>
          {rupees(row.allowedAmount)}
        </span>
      ),
    },
    {
      key: 'verified',
      header: 'Proof verified',
      render: (row) =>
        row.verified ? (
          'Yes'
        ) : (
          <span className="text-amber-700">Not verified</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <SelectField
          id="form16-employee"
          label="Employee"
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        >
          <option value="">Select an employee</option>
          {employees?.items.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.employeeCode} ·{' '}
              {[employee.firstName, employee.lastName].filter(Boolean).join(' ')}
            </option>
          ))}
        </SelectField>
        <TextField
          id="form16-fy"
          label="Financial year"
          value={financialYear}
          onChange={(event) => setFinancialYear(event.target.value)}
        />
      </div>

      {!employeeId ? (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          Choose an employee to see the figures behind their Form 16.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading…
        </p>
      ) : isError || !data ? (
        <p className="text-sm text-red-600" role="alert">
          {MESSAGES.loadFailed}
        </p>
      ) : (
        <>
          <dl className="max-w-md divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
            {(
              [
                ['Gross salary', data.grossSalary],
                ['Standard deduction', -data.standardDeduction],
                [
                  'Chapter VI-A deductions (allowed)',
                  -data.deductionsBySection.reduce(
                    (sum, row) => sum + row.allowedAmount,
                    0,
                  ),
                ],
              ] as [string, number][]
            ).map(([label, value]) => (
              <div key={label} className="flex justify-between px-4 py-2.5">
                <dt className="text-gray-600">{label}</dt>
                <dd className={value < 0 ? 'tabular-nums text-red-700' : 'tabular-nums'}>
                  {rupees(value)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between bg-gray-50 px-4 py-2.5 font-medium">
              <dt>Taxable income</dt>
              <dd className="tabular-nums">{rupees(data.taxableIncome)}</dd>
            </div>
            <div className="flex justify-between px-4 py-2.5 font-medium">
              <dt>Tax deducted to date</dt>
              <dd className="tabular-nums">{rupees(data.taxDeducted)}</dd>
            </div>
          </dl>

          <DataTable
            caption="Chapter VI-A deductions"
            columns={columns}
            rows={data.deductionsBySection}
            rowKey={(row) => row.sectionCode}
            emptyMessage="Nothing declared for this year."
          />
        </>
      )}
    </div>
  );
}
