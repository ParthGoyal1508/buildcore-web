'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  downloadBankSheet,
  exportSalaryRegister,
  getDeductionReport,
  getPayrollRun,
  getSalaryRegister,
  saveBlob,
  setPayrollRunStatus,
  type PayrollLineItem,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, MESSAGES } from '@/app/lib/constants';
import { money, periodLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import { lusitana } from '@/app/ui/fonts';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';

const TABS = [
  { id: 'lines', label: 'Line items' },
  { id: 'register', label: 'Salary register' },
  { id: 'deductions', label: 'Deduction report' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const gross = (line: PayrollLineItem) =>
  line.basic +
  line.hra +
  line.conveyanceAllowance +
  line.siteAllowance +
  line.specialAllowance +
  line.otWages;

const deductions = (line: PayrollLineItem) =>
  line.employeePf +
  line.employeeEsic +
  line.professionalTax +
  line.tds +
  line.loanEmiDeduction;

export default function PayrollRunDetail({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>('lines');
  const [error, setError] = useState<string | null>(null);

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ['hr', 'payrollRun', runId],
    queryFn: () => getPayrollRun(runId),
  });

  const processed = run ? run.status !== 'draft' : false;

  // Both reports refuse a draft run server-side, so they are only fetched once the
  // run is past draft — asking earlier would render a 400 as if it were a failure.
  const { data: register } = useQuery({
    queryKey: ['hr', 'salaryRegister', runId],
    queryFn: () => getSalaryRegister(runId),
    enabled: processed && tab === 'register',
  });

  const { data: deductionReport } = useQuery({
    queryKey: ['hr', 'deductionReport', runId],
    queryFn: () => getDeductionReport(runId),
    enabled: processed && tab === 'deductions',
  });

  /**
   * Exports are only offered on a processed or paid run.
   *
   * A bank sheet generated from a draft is a payment instruction built on figures
   * that are still allowed to move — the worst possible thing to hand to a bank.
   */
  const exportSheet = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await downloadBankSheet(runId);
      saveBlob(blob, filename);
    },
    onError: (err: Error) => setError(err.message),
  });

  const exportRegister = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await exportSalaryRegister(runId);
      saveBlob(blob, filename);
    },
    onError: (err: Error) => setError(err.message),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'processed' | 'paid') => setPayrollRunStatus(runId, status),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRun', runId] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
      // Processing locks the period against attendance edits.
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !run) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }

  const lines = run.lineItems ?? [];
  const runTotals = lines.reduce(
    (totals, line) => ({
      gross: totals.gross + gross(line),
      deductions: totals.deductions + deductions(line),
      net: totals.net + line.netPay,
    }),
    { gross: 0, deductions: 0, net: 0 },
  );

  const lineColumns: Column<PayrollLineItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (line) => line.name ?? line.employeeCode ?? line.employeeId,
    },
    { key: 'days', header: 'Days paid', numeric: true, render: (l) => money(l.payableDays) },
    { key: 'lop', header: 'LOP', numeric: true, render: (l) => money(l.lopDays) },
    { key: 'basic', header: 'Basic', numeric: true, render: (l) => money(l.basic) },
    { key: 'hra', header: 'HRA', numeric: true, render: (l) => money(l.hra) },
    { key: 'ot', header: 'OT', numeric: true, render: (l) => money(l.otWages) },
    { key: 'gross', header: 'Gross', numeric: true, render: (l) => money(gross(l)) },
    { key: 'pf', header: 'PF', numeric: true, render: (l) => money(l.employeePf) },
    { key: 'esic', header: 'ESIC', numeric: true, render: (l) => money(l.employeeEsic) },
    { key: 'pt', header: 'PT', numeric: true, render: (l) => money(l.professionalTax) },
    { key: 'tds', header: 'TDS', numeric: true, render: (l) => money(l.tds) },
    { key: 'emi', header: 'Loan EMI', numeric: true, render: (l) => money(l.loanEmiDeduction) },
    { key: 'net', header: 'Net pay', numeric: true, render: (l) => money(l.netPay) },
  ];

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} text-2xl`}>
            {periodLabel(run.period)}
            {run.isFnf && ' · Full & Final'}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <StatusBadge status={run.status} />
            <span>
              {lines.length} employee{lines.length === 1 ? '' : 's'} ·{' '}
              {rupees(runTotals.net)} net
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <Button
              type="button"
              onClick={() => {
                if (window.confirm(HR_MESSAGES.confirmProcessRun)) {
                  setStatus.mutate('processed');
                }
              }}
              disabled={setStatus.isPending}
            >
              Process run
            </Button>
          )}
          {run.status === 'processed' && (
            <Button
              type="button"
              onClick={() => {
                if (window.confirm(HR_MESSAGES.confirmMarkPaid)) {
                  setStatus.mutate('paid');
                }
              }}
              disabled={setStatus.isPending}
            >
              Mark as paid
            </Button>
          )}
          {processed && (
            <SecondaryButton
              type="button"
              onClick={() => exportSheet.mutate()}
              disabled={exportSheet.isPending}
            >
              {exportSheet.isPending ? 'Preparing…' : 'Bank sheet'}
            </SecondaryButton>
          )}
        </div>
      </div>

      <FormError message={error} />

      {run.exceptions && run.exceptions.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p className="font-medium">
            {run.exceptions.length} exception
            {run.exceptions.length === 1 ? '' : 's'} in this run
          </p>
          <ul className="mt-1 list-inside list-disc">
            {run.exceptions.map((exception) => (
              <li key={exception}>{exception}</li>
            ))}
          </ul>
        </div>
      )}

      <TabStrip tabs={TABS} active={tab} onChange={setTab} idPrefix="run" />

      <TabPanel id="lines" idPrefix="run" active={tab}>
        <DataTable
          caption="Payroll line items"
          columns={lineColumns}
          rows={lines}
          rowKey={(line) => line.id ?? line.employeeId}
          emptyMessage="This run has no line items."
          footer={
            <tr>
              <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5">Total</td>
              <td colSpan={5} />
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(runTotals.gross)}
              </td>
              <td colSpan={5} />
              <td className="px-3 py-2.5 text-right tabular-nums">
                {money(runTotals.net)}
              </td>
            </tr>
          }
        />
      </TabPanel>

      <TabPanel id="register" idPrefix="run" active={tab}>
        {!processed ? (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {HR_MESSAGES.registerNeedsProcessedRun}
          </p>
        ) : (
          <>
            {/* A register that disagrees with its own run is exactly what this
                check exists to catch, so it blocks the eye rather than passing as
                a toast. */}
            {register && !register.reconciliation.ok && (
              <p
                role="alert"
                className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {register.reconciliation.message}
              </p>
            )}
            <div className="mb-3 flex justify-end">
              <SecondaryButton
                type="button"
                onClick={() => exportRegister.mutate()}
                disabled={exportRegister.isPending}
              >
                {exportRegister.isPending ? 'Preparing…' : 'Export register'}
              </SecondaryButton>
            </div>
            <DataTable
              caption="Salary register"
              columns={[
                { key: 'code', header: 'Code', sticky: true, render: (r) => r.employeeCode },
                { key: 'name', header: 'Name', render: (r) => r.name },
                { key: 'days', header: 'Days', numeric: true, render: (r) => money(r.daysPaid) },
                { key: 'lop', header: 'LOP', numeric: true, render: (r) => money(r.lopDays) },
                { key: 'basic', header: 'Basic', numeric: true, render: (r) => money(r.basic) },
                { key: 'hra', header: 'HRA', numeric: true, render: (r) => money(r.hra) },
                { key: 'conv', header: 'Conveyance', numeric: true, render: (r) => money(r.conveyance) },
                { key: 'site', header: 'Site allw.', numeric: true, render: (r) => money(r.siteAllowance) },
                { key: 'special', header: 'Special allw.', numeric: true, render: (r) => money(r.specialAllowance) },
                { key: 'ot', header: 'OT', numeric: true, render: (r) => money(r.otWages) },
                { key: 'gross', header: 'Gross', numeric: true, render: (r) => money(r.gross) },
                { key: 'pf', header: 'PF', numeric: true, render: (r) => money(r.employeePf) },
                { key: 'esic', header: 'ESIC', numeric: true, render: (r) => money(r.employeeEsic) },
                { key: 'pt', header: 'PT', numeric: true, render: (r) => money(r.professionalTax) },
                { key: 'tds', header: 'TDS', numeric: true, render: (r) => money(r.tds) },
                { key: 'emi', header: 'Loan EMI', numeric: true, render: (r) => money(r.loanEmi) },
                { key: 'ded', header: 'Deductions', numeric: true, render: (r) => money(r.totalDeductions) },
                { key: 'net', header: 'Net pay', numeric: true, render: (r) => money(r.netPay) },
              ]}
              rows={register?.rows ?? []}
              rowKey={(r) => r.employeeCode}
              emptyMessage="No rows in this register."
              footer={
                register && (
                  <tr>
                    <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5">Total</td>
                    <td colSpan={9} />
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {money(register.totals.gross)}
                    </td>
                    <td colSpan={5} />
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {money(register.totals.totalDeductions)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {money(register.totals.netPay)}
                    </td>
                  </tr>
                )
              }
            />
          </>
        )}
      </TabPanel>

      <TabPanel id="deductions" idPrefix="run" active={tab}>
        {!processed ? (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {HR_MESSAGES.registerNeedsProcessedRun}
          </p>
        ) : (
          <>
            <DataTable
              caption="Deduction report"
              columns={[
                { key: 'head', header: 'Head', sticky: true, render: (h) => h.head },
                {
                  key: 'statutory',
                  header: 'Statutory',
                  render: (h) => (h.statutory ? 'Yes' : 'No'),
                },
                {
                  key: 'count',
                  header: 'Employees',
                  numeric: true,
                  render: (h) => h.employeeCount,
                },
                { key: 'total', header: 'Total', numeric: true, render: (h) => money(h.total) },
              ]}
              rows={deductionReport?.heads ?? []}
              rowKey={(h) => h.head}
              emptyMessage="Nothing was deducted in this run."
            />
            {deductionReport && (
              <p className="mt-3 text-sm text-gray-600">
                Statutory {rupees(deductionReport.totals.statutory)} ·
                Non-statutory {rupees(deductionReport.totals.nonStatutory)}. These
                are the same figures the challans derive from — both read the run&apos;s
                line items.
              </p>
            )}
          </>
        )}
      </TabPanel>
    </main>
  );
}
