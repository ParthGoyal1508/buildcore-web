'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  discardPayrollRun,
  downloadBankSheet,
  exportSalaryRegister,
  getDeductionReport,
  getPayrollRun,
  getSalaryRegister,
  isStaleDraftError,
  saveBlob,
  setPayrollRunStatus,
  unsubmittedRunOf,
  type PayrollLineItem,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, ROUTES } from '@/app/lib/constants';
import { money, periodLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { downloadCsv } from '@/app/ui/hr/csv';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import SlipDelivery from '@/app/ui/hr/slip-delivery';
import SubmitRunApproval from '@/app/ui/hr/submit-run-approval';
import TransactionReconciliation from '@/app/ui/hr/transaction-reconciliation';
import { confirmDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';

const TABS = [
  { id: 'lines', label: 'Line items' },
  { id: 'register', label: 'Salary register' },
  { id: 'deductions', label: 'Deduction report' },
  // 021 FR-006 to FR-011 (`bugs.md` item 8). Both tabs, and in this order: the slips go out after
  // the money moves, and the bank's sheet comes back after that.
  { id: 'delivery', label: 'Payslip delivery' },
  { id: 'reconciliation', label: 'Bank reconciliation' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const n = (value: number | undefined) => value ?? 0;

/**
 * Gross and deductions **as the server computed them** (036 F8). The screen used to add the columns
 * up itself and left out conveyance, site and special allowances, fuel recovery and the advance
 * recovered, so its Gross and its totals never matched Net. The fallback is only for a response
 * from before the server sent its totals, and it uses every head.
 */
const gross = (line: PayrollLineItem) =>
  line.gross ??
  line.basic +
    line.hra +
    line.conveyanceAllowance +
    line.siteAllowance +
    line.specialAllowance +
    line.otWages;

const deductions = (line: PayrollLineItem) =>
  line.totalDeductions ??
  line.employeePf +
    line.employeeEsic +
    line.professionalTax +
    line.tds +
    line.loanEmiDeduction +
    n(line.fuelRecoveryDeduction) +
    n(line.advanceRecovered);

/** One money column of the line-items table, with the total its footer shows. */
interface MoneyColumn {
  key: string;
  header: string;
  value: (line: PayrollLineItem) => number;
}

const MONEY_COLUMNS: MoneyColumn[] = [
  { key: 'basic', header: 'Basic', value: (l) => l.basic },
  { key: 'hra', header: 'HRA', value: (l) => l.hra },
  { key: 'conv', header: 'Conveyance', value: (l) => l.conveyanceAllowance },
  { key: 'site', header: 'Site allw.', value: (l) => l.siteAllowance },
  { key: 'special', header: 'Special allw.', value: (l) => l.specialAllowance },
  { key: 'ot', header: 'OT', value: (l) => l.otWages },
  { key: 'gross', header: 'Gross', value: gross },
  { key: 'pf', header: 'PF', value: (l) => l.employeePf },
  { key: 'esic', header: 'ESIC', value: (l) => l.employeeEsic },
  { key: 'pt', header: 'PT', value: (l) => l.professionalTax },
  { key: 'tds', header: 'TDS', value: (l) => l.tds },
  { key: 'emi', header: 'Loan EMI', value: (l) => l.loanEmiDeduction },
  { key: 'fuel', header: 'Fuel recovery', value: (l) => n(l.fuelRecoveryDeduction) },
  { key: 'advance', header: 'Advance', value: (l) => n(l.advanceRecovered) },
  { key: 'deductions', header: 'Deductions', value: deductions },
  { key: 'reimb', header: 'Reimb.', value: (l) => n(l.reimbursementTotal) },
  { key: 'net', header: 'Net pay', value: (l) => l.netPay },
];

const nameOf = (line: PayrollLineItem) =>
  line.name ?? line.employeeCode ?? line.employeeId;

export default function PayrollRunDetail({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('lines');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // A run never put into its approval chain: the bank sheet refusal offers to submit it.
  const [unsubmittedRun, setUnsubmittedRun] = useState<string | null>(null);

  const runQuery = useQuery({
    queryKey: ['hr', 'payrollRun', runId],
    queryFn: () => getPayrollRun(runId),
  });
  const run = runQuery.data;

  const processed = run ? run.status !== 'draft' : false;

  // Both reports refuse a draft run server-side, so they are only fetched once the
  // run is past draft — asking earlier would render a 400 as if it were a failure.
  const registerQuery = useQuery({
    queryKey: ['hr', 'salaryRegister', runId],
    queryFn: () => getSalaryRegister(runId),
    enabled: processed && tab === 'register',
  });
  const register = registerQuery.data;

  const deductionQuery = useQuery({
    queryKey: ['hr', 'deductionReport', runId],
    queryFn: () => getDeductionReport(runId),
    enabled: processed && tab === 'deductions',
  });
  const deductionReport = deductionQuery.data;

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
      void queryClient.invalidateQueries({ queryKey: ['hr', 'bank-sheet-history'] });
    },
    onError: (err: Error) => {
      setError(errorMessage(err, 'Could not generate the bank sheet.'));
      setUnsubmittedRun(unsubmittedRunOf(err));
    },
  });

  const exportRegister = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await exportSalaryRegister(runId);
      saveBlob(blob, filename);
    },
    onError: (err: Error) =>
      setError(errorMessage(err, 'Could not export the register.')),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'processed' | 'paid') =>
      setPayrollRunStatus(runId, status),
    onSuccess: (_result, status) => {
      setError(null);
      setUnsubmittedRun(null);
      toast.success(status === 'paid' ? 'Run marked as paid.' : 'Run processed.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRun', runId] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
      // Processing locks the period against attendance edits.
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
    onError: (err: Error) => {
      // 036: a draft whose advances, fuel recoveries or claims moved since it was generated is
      // refused (409 PAYROLL_DRAFT_STALE). The fix is to regenerate it, so say exactly that.
      setError(
        isStaleDraftError(err)
          ? `${errorMessage(err)} Go back to Payroll runs and generate ${
              run ? periodLabel(run.period) : 'this period'
            } again, then process the new draft.`
          : errorMessage(err, 'Could not change the run status.'),
      );
      // Mark as paid on a run never put into its approval chain (409 PAYROLL_RUN_NOT_SUBMITTED).
      setUnsubmittedRun(unsubmittedRunOf(err));
    },
  });

  const discard = useMutation({
    mutationFn: () => discardPayrollRun(runId),
    onSuccess: () => {
      toast.success('Draft discarded.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
      queryClient.removeQueries({ queryKey: ['hr', 'payrollRun', runId] });
      router.push(ROUTES.hrPayroll);
    },
    onError: (err: Error) =>
      setError(errorMessage(err, 'Could not discard the draft.')),
  });

  const lines = useMemo(() => run?.lineItems ?? [], [run]);
  // 036 F9: find one person in a run of hundreds, by name or code.
  const visibleLines = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return lines;
    return lines.filter((line) =>
      [line.name, line.employeeCode]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [lines, search]);

  if (runQuery.isPending) {
    return (
      <div role="status" className="p-4">
        <span className="sr-only">Loading…</span>
        <ListSkeleton headers={['Employee', 'Days paid', 'Gross', 'Net pay']} rows={8} />
      </div>
    );
  }
  if (runQuery.isError || !run) {
    return (
      <QueryError
        error={runQuery.error}
        onRetry={() => runQuery.refetch()}
      />
    );
  }

  // Totals of the rows shown, so a search totals what it found.
  const totals = Object.fromEntries(
    MONEY_COLUMNS.map((c) => [
      c.key,
      visibleLines.reduce((sum, line) => sum + c.value(line), 0),
    ]),
  ) as Record<string, number>;
  const runNet = lines.reduce((sum, line) => sum + line.netPay, 0);

  const lineColumns: Column<PayrollLineItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (line) => nameOf(line),
      sortValue: (line) => nameOf(line),
    },
    {
      key: 'days',
      header: 'Days paid',
      numeric: true,
      render: (l) => money(l.payableDays),
      sortValue: (l) => l.payableDays,
    },
    {
      key: 'lop',
      header: 'LOP',
      numeric: true,
      render: (l) => money(l.lopDays),
      sortValue: (l) => l.lopDays,
    },
    ...MONEY_COLUMNS.map(
      (c): Column<PayrollLineItem> => ({
        key: c.key,
        header: c.header,
        numeric: true,
        render: (l) => money(c.value(l)),
        sortValue: (l) => c.value(l),
      }),
    ),
  ];

  const exportLines = () =>
    downloadCsv(
      `Payroll_${run.period}_line_items.csv`,
      ['Code', 'Employee', 'Days paid', 'LOP', ...MONEY_COLUMNS.map((c) => c.header)],
      visibleLines.map((line) => [
        line.employeeCode ?? '',
        line.name ?? '',
        line.payableDays,
        line.lopDays,
        ...MONEY_COLUMNS.map((c) => c.value(line).toFixed(2)),
      ]),
    );

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeader
            title={
              <>
                {periodLabel(run.period)}
                {run.isFnf && ' · Full & Final'}
              </>
            }
          />
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-600">
            <StatusBadge status={run.status} />
            <span>
              {lines.length} employee{lines.length === 1 ? '' : 's'} ·{' '}
              {rupees(runNet)} net
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {run.status === 'draft' && (
            <>
              <Button
                type="button"
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Process payroll run?',
                      message: HR_MESSAGES.confirmProcessRun,
                      confirmLabel: 'Process',
                      tone: 'default',
                    })
                  ) {
                    setStatus.mutate('processed');
                  }
                }}
                loading={setStatus.isPending}
                disabled={discard.isPending}
              >
                Process run
              </Button>
              <SecondaryButton
                type="button"
                loading={discard.isPending}
                disabled={setStatus.isPending}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Discard this draft?',
                      message: `The ${periodLabel(run.period)} draft and its ${lines.length} line${
                        lines.length === 1 ? '' : 's'
                      } are deleted. Nothing has been paid or recovered from it, so nothing else changes. You can generate the period again.`,
                      confirmLabel: 'Discard draft',
                      tone: 'danger',
                    })
                  ) {
                    discard.mutate();
                  }
                }}
              >
                Discard draft
              </SecondaryButton>
            </>
          )}
          {run.status === 'processed' && (
            <Button
              type="button"
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Mark run as paid?',
                    message: HR_MESSAGES.confirmMarkPaid,
                    confirmLabel: 'Mark as paid',
                    tone: 'default',
                  })
                ) {
                  setStatus.mutate('paid');
                }
              }}
              loading={setStatus.isPending}
            >
              Mark as paid
            </Button>
          )}
          {processed && (
            <SecondaryButton
              type="button"
              onClick={() => exportSheet.mutate()}
              loading={exportSheet.isPending}
            >
              Bank sheet
            </SecondaryButton>
          )}
        </div>
      </div>

      <FormError message={error} />
      {unsubmittedRun && <SubmitRunApproval runId={unsubmittedRun} />}

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
              <li key={`${exception.employeeId}-${exception.reason}`}>
                <span className="font-medium">
                  {exception.name ?? exception.employeeCode ?? 'Employee'}
                  {exception.name && exception.employeeCode
                    ? ` (${exception.employeeCode})`
                    : ''}
                </span>
                : {exception.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TabStrip tabs={TABS} active={tab} onChange={setTab} idPrefix="run" />

      <TabPanel id="lines" idPrefix="run" active={tab}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="w-full max-w-xs">
            <label htmlFor="run-line-search" className="sr-only">
              Search employees
            </label>
            <input
              id="run-line-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or code"
              className="block min-h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>
          <SecondaryButton
            type="button"
            onClick={exportLines}
            disabled={visibleLines.length === 0}
          >
            Export CSV
          </SecondaryButton>
        </div>
        <DataTable
          caption="Payroll line items"
          columns={lineColumns}
          rows={visibleLines}
          rowKey={(line) => line.id ?? line.employeeId}
          stickyHeader
          emptyMessage={
            search.trim()
              ? 'No employee in this run matches that search.'
              : 'This run has no line items.'
          }
          footer={
            <tr>
              <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5">
                Total
              </td>
              <td colSpan={2} />
              {MONEY_COLUMNS.map((c) => (
                <td key={c.key} className="px-3 py-2.5 text-right tabular-nums">
                  {money(totals[c.key])}
                </td>
              ))}
            </tr>
          }
        />
      </TabPanel>

      <TabPanel id="delivery" idPrefix="run" active={tab}>
        {!processed ? (
          /*
            FR-009 asks for the reason rather than a disabled control. A draft run has no publishable
            figures, so there is nothing to email — and saying so is what stops somebody waiting for
            an email that was never going to be sent.
          */
          <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {HR_MESSAGES.deliveryNeedsProcessedRun}
          </p>
        ) : (
          <SlipDelivery runId={runId} />
        )}
      </TabPanel>

      <TabPanel id="reconciliation" idPrefix="run" active={tab}>
        {!processed ? (
          <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {HR_MESSAGES.reconciliationNeedsProcessedRun}
          </p>
        ) : (
          <TransactionReconciliation runId={runId} />
        )}
      </TabPanel>

      <TabPanel id="register" idPrefix="run" active={tab}>
        {!processed ? (
          <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
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
                loading={exportRegister.isPending}
              >
                Export register
              </SecondaryButton>
            </div>
            <DataTable
              caption="Salary register"
              columns={[
                {
                  key: 'code',
                  header: 'Code',
                  sticky: true,
                  render: (r) => r.employeeCode,
                },
                { key: 'name', header: 'Name', render: (r) => r.name },
                {
                  key: 'days',
                  header: 'Days',
                  numeric: true,
                  render: (r) => money(r.daysPaid),
                },
                {
                  key: 'lop',
                  header: 'LOP',
                  numeric: true,
                  render: (r) => money(r.lopDays),
                },
                {
                  key: 'basic',
                  header: 'Basic',
                  numeric: true,
                  render: (r) => money(r.basic),
                },
                {
                  key: 'hra',
                  header: 'HRA',
                  numeric: true,
                  render: (r) => money(r.hra),
                },
                {
                  key: 'conv',
                  header: 'Conveyance',
                  numeric: true,
                  render: (r) => money(r.conveyance),
                },
                {
                  key: 'site',
                  header: 'Site allw.',
                  numeric: true,
                  render: (r) => money(r.siteAllowance),
                },
                {
                  key: 'special',
                  header: 'Special allw.',
                  numeric: true,
                  render: (r) => money(r.specialAllowance),
                },
                {
                  key: 'ot',
                  header: 'OT',
                  numeric: true,
                  render: (r) => money(r.otWages),
                },
                {
                  key: 'gross',
                  header: 'Gross',
                  numeric: true,
                  render: (r) => money(r.gross),
                },
                {
                  key: 'pf',
                  header: 'PF',
                  numeric: true,
                  render: (r) => money(r.employeePf),
                },
                {
                  key: 'esic',
                  header: 'ESIC',
                  numeric: true,
                  render: (r) => money(r.employeeEsic),
                },
                {
                  key: 'pt',
                  header: 'PT',
                  numeric: true,
                  render: (r) => money(r.professionalTax),
                },
                {
                  key: 'tds',
                  header: 'TDS',
                  numeric: true,
                  render: (r) => money(r.tds),
                },
                {
                  key: 'emi',
                  header: 'Loan EMI',
                  numeric: true,
                  render: (r) => money(r.loanEmi),
                },
                {
                  key: 'ded',
                  header: 'Deductions',
                  numeric: true,
                  render: (r) => money(r.totalDeductions),
                },
                {
                  key: 'net',
                  header: 'Net pay',
                  numeric: true,
                  render: (r) => money(r.netPay),
                },
              ]}
              rows={register?.rows ?? []}
              rowKey={(r) => r.employeeCode}
              stickyHeader
              // 036 F9: "No rows" used to show while loading and after a failure.
              isLoading={registerQuery.isPending}
              error={registerQuery.isError ? registerQuery.error : undefined}
              onRetry={() => registerQuery.refetch()}
              emptyMessage="No rows in this register."
              footer={
                register && (
                  <tr>
                    <td className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5">
                      Total
                    </td>
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
          <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {HR_MESSAGES.registerNeedsProcessedRun}
          </p>
        ) : (
          <>
            <DataTable
              caption="Deduction report"
              columns={[
                {
                  key: 'head',
                  header: 'Head',
                  sticky: true,
                  render: (h) => h.head,
                },
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
                {
                  key: 'total',
                  header: 'Total',
                  numeric: true,
                  render: (h) => money(h.total),
                },
              ]}
              rows={deductionReport?.heads ?? []}
              rowKey={(h) => h.head}
              isLoading={deductionQuery.isPending}
              error={deductionQuery.isError ? deductionQuery.error : undefined}
              onRetry={() => deductionQuery.refetch()}
              emptyMessage="Nothing was deducted in this run."
            />
            {deductionReport && (
              <p className="mt-3 text-sm text-gray-600">
                Statutory {rupees(deductionReport.totals.statutory)} ·
                Non-statutory {rupees(deductionReport.totals.nonStatutory)}.
                These are the same figures the challans derive from — both read
                the run&apos;s line items.
              </p>
            )}
          </>
        )}
      </TabPanel>
    </main>
  );
}
