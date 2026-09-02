'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getTaxDeclaration,
  listEmployees,
  saveTaxDeclaration,
  verifyDeclarationLine,
} from '@/app/lib/api/hr-payroll';
import { TDS_SECTIONS, TDS_SECTION_CEILINGS } from '@/app/lib/constants';
import { financialYearOf, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import {
  FormError,
  RowAction,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

interface LineDraft {
  id?: string;
  sectionCode: string;
  declaredAmount: string;
  proofRef: string;
  status?: string;
}

/** What the section actually allows, given what was declared. */
function capped(sectionCode: string, declared: number): number {
  const ceiling = TDS_SECTION_CEILINGS[sectionCode];
  if (ceiling === undefined || ceiling === 0) return declared;
  return Math.min(declared, ceiling);
}

export default function TaxDeclarationForm() {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [financialYear, setFinancialYear] = useState(financialYearOf());
  const [regime, setRegime] = useState<'old' | 'new'>('old');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });

  const { data: declaration, isLoading } = useQuery({
    queryKey: ['hr', 'taxDeclaration', employeeId, financialYear],
    queryFn: () => getTaxDeclaration(employeeId, financialYear),
    enabled: employeeId.length > 0,
  });

  // Adjusted during render rather than in an effect — see the same note in
  // tax-slab-editor.tsx. Switching employee must not briefly show the previous
  // employee's declaration.
  const [loadedFrom, setLoadedFrom] = useState<typeof declaration>(undefined);
  if (declaration !== loadedFrom) {
    setLoadedFrom(declaration);
    if (declaration) {
      setRegime(declaration.regime);
      setLines(
        declaration.lines.map((line) => ({
          id: line.id,
          sectionCode: line.sectionCode,
          declaredAmount: String(line.declaredAmount),
          proofRef: line.proofRef ?? '',
          status: line.status,
        })),
      );
    } else {
      setLines([]);
    }
  }

  const save = useMutation({
    mutationFn: () =>
      saveTaxDeclaration(employeeId, {
        financialYear,
        regime,
        lines: lines
          .filter((line) => line.sectionCode && Number(line.declaredAmount) > 0)
          .map((line) => ({
            sectionCode: line.sectionCode,
            declaredAmount: Number(line.declaredAmount),
            proofRef: line.proofRef.trim() || undefined,
          })),
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'taxDeclaration'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const verify = useMutation({
    mutationFn: verifyDeclarationLine,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['hr', 'taxDeclaration'] }),
    onError: (err: Error) => setError(err.message),
  });

  const totalDeclared = lines.reduce(
    (sum, line) => sum + (Number(line.declaredAmount) || 0),
    0,
  );
  const totalAllowed = lines.reduce(
    (sum, line) => sum + capped(line.sectionCode, Number(line.declaredAmount) || 0),
    0,
  );

  const columns: Column<LineDraft>[] = [
    {
      key: 'section',
      header: 'Section',
      sticky: true,
      render: (line) => {
        const index = lines.indexOf(line);
        return (
          <select
            aria-label={`Section for line ${index + 1}`}
            value={line.sectionCode}
            onChange={(event) =>
              setLines((current) =>
                current.map((l, i) =>
                  i === index ? { ...l, sectionCode: event.target.value } : l,
                ),
              )
            }
            className="rounded-md border border-gray-200 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <option value="">Select</option>
            {TDS_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'declared',
      header: 'Declared',
      numeric: true,
      render: (line) => {
        const index = lines.indexOf(line);
        return (
          <input
            type="number"
            step="0.01"
            aria-label={`Declared amount for line ${index + 1}`}
            value={line.declaredAmount}
            onChange={(event) =>
              setLines((current) =>
                current.map((l, i) =>
                  i === index ? { ...l, declaredAmount: event.target.value } : l,
                ),
              )
            }
            className="w-32 rounded-md border border-gray-200 px-2 py-1 text-right text-sm tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
        );
      },
    },
    {
      key: 'allowed',
      header: 'Allowed',
      numeric: true,
      // The whole point of this column: a ₹300,000 80C declaration is worth
      // ₹150,000, and learning that from the payslip is what generates the query.
      render: (line) => {
        const declared = Number(line.declaredAmount) || 0;
        const allowed = capped(line.sectionCode, declared);
        return (
          <span className={allowed < declared ? 'text-amber-700' : undefined}>
            {rupees(allowed)}
            {allowed < declared && (
              <span className="block text-xs">
                capped at {rupees(TDS_SECTION_CEILINGS[line.sectionCode])}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: 'proof',
      header: 'Proof reference',
      render: (line) => {
        const index = lines.indexOf(line);
        return (
          <input
            type="text"
            aria-label={`Proof reference for line ${index + 1}`}
            value={line.proofRef}
            onChange={(event) =>
              setLines((current) =>
                current.map((l, i) =>
                  i === index ? { ...l, proofRef: event.target.value } : l,
                ),
              )
            }
            className="w-44 rounded-md border border-gray-200 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          />
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (line) => <StatusBadge status={line.status ?? 'declared'} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          id="declaration-employee"
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
          id="declaration-fy"
          label="Financial year"
          value={financialYear}
          onChange={(event) => setFinancialYear(event.target.value)}
        />
        <SelectField
          id="declaration-regime"
          label="Regime"
          value={regime}
          onChange={(event) => setRegime(event.target.value as 'old' | 'new')}
        >
          <option value="old">Old</option>
          <option value="new">New</option>
        </SelectField>
      </div>

      {!employeeId ? (
        <p className="rounded-lg bg-gray-50 p-6 text-sm text-gray-500">
          Choose an employee to see or record their declaration.
        </p>
      ) : (
        <>
          <FormError message={error} />
          {saved && (
            <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              Declaration saved.
            </p>
          )}

          <DataTable
            caption="Declaration lines"
            columns={columns}
            rows={lines}
            rowKey={(line) => line.id ?? `${line.sectionCode}-${lines.indexOf(line)}`}
            isLoading={isLoading}
            error={null}
            emptyMessage="Nothing declared yet."
            actions={(line) => (
              <>
                {line.id && line.status !== 'verified' && (
                  <RowAction type="button" onClick={() => verify.mutate(line.id!)}>
                    Verify
                  </RowAction>
                )}
                <RowAction
                  type="button"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((_, i) => i !== current.indexOf(line)),
                    )
                  }
                >
                  Remove
                </RowAction>
              </>
            )}
            footer={
              lines.length > 0 ? (
                <tr>
                  <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {rupees(totalDeclared)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {rupees(totalAllowed)}
                  </td>
                  <td colSpan={3} />
                </tr>
              ) : null
            }
          />

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  { sectionCode: '', declaredAmount: '', proofRef: '' },
                ])
              }
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Add a line
            </button>
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || lines.length === 0}
            >
              {save.isPending ? 'Saving…' : 'Save declaration'}
            </Button>
          </div>

          <p className="text-xs text-gray-600">
            Verifying a line records that its proof was seen. Declarations verified
            after the proof cut-off month are still honoured, but the tax already
            deducted is not refunded through payroll — it is claimed on the return.
          </p>
        </>
      )}
    </div>
  );
}
