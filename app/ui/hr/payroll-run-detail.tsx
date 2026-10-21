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
  isRunApproved,
  isRunEditable,
  isStaleDraftError,
  saveBlob,
  setPayrollRunStatus,
  submitPayrollRunForApproval,
  unsubmittedRunOf,
  type PayrollLineItem,
  type PayrollRun,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, ROUTES } from '@/app/lib/constants';
import { dateTimeLabel, money, periodLabel, rupees } from '@/app/lib/format';
import DecisionHistory from '@/app/ui/approvals/decision-history';
import { Button, RowAction } from '@/app/ui/button';
import { downloadCsv } from '@/app/ui/hr/csv';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import SlipDelivery from '@/app/ui/hr/slip-delivery';
import SubmitRunApproval from '@/app/ui/hr/submit-run-approval';
import {
  EditLineModal,
  LineHistoryModal,
  RunEditsTable,
} from '@/app/ui/hr/payroll-line-edits';
import RunApprovalBadge from '@/app/ui/hr/run-approval-badge';
import TransactionReconciliation from '@/app/ui/hr/transaction-reconciliation';
import { confirmDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';

const TABS = [
  { id: 'lines', label: 'Line items' },
  // 039: every hand correction in the run, for whoever checks it before it goes to the Director.
  { id: 'changes', label: 'Changes' },
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
  /** The line column it shows, when HR may correct it by hand (039) — for the highlight. */
  field?: string;
}

const MONEY_COLUMNS: MoneyColumn[] = [
  { key: 'basic', header: 'Basic', value: (l) => l.basic, field: 'basic' },
  { key: 'hra', header: 'HRA', value: (l) => l.hra, field: 'hra' },
  {
    key: 'conv',
    header: 'Conveyance',
    value: (l) => l.conveyanceAllowance,
    field: 'conveyanceAllowance',
  },
  { key: 'site', header: 'Site allw.', value: (l) => l.siteAllowance, field: 'siteAllowance' },
  {
    key: 'special',
    header: 'Special allw.',
    value: (l) => l.specialAllowance,
    field: 'specialAllowance',
  },
  { key: 'ot', header: 'OT', value: (l) => l.otWages, field: 'otWages' },
  { key: 'gross', header: 'Gross', value: gross },
  { key: 'pf', header: 'PF', value: (l) => l.employeePf, field: 'employeePf' },
  { key: 'esic', header: 'ESIC', value: (l) => l.employeeEsic, field: 'employeeEsic' },
  { key: 'pt', header: 'PT', value: (l) => l.professionalTax, field: 'professionalTax' },
  { key: 'tds', header: 'TDS', value: (l) => l.tds, field: 'tds' },
  { key: 'emi', header: 'Loan EMI', value: (l) => l.loanEmiDeduction },
  { key: 'fuel', header: 'Fuel recovery', value: (l) => n(l.fuelRecoveryDeduction) },
  { key: 'advance', header: 'Advance', value: (l) => n(l.advanceRecovered) },
  { key: 'deductions', header: 'Deductions', value: deductions },
  { key: 'reimb', header: 'Reimb.', value: (l) => n(l.reimbursementTotal) },
  { key: 'net', header: 'Net pay', value: (l) => l.netPay },
];

const nameOf = (line: PayrollLineItem) =>
  line.name ?? line.employeeCode ?? line.employeeId;

/** A figure corrected by hand (039): highlighted, and said in words for a screen reader. */
const EDITED_CELL = 'rounded bg-amber-100 px-1 font-semibold text-amber-900';
const DERIVED_CELL = 'rounded bg-amber-50 px-1 text-amber-900';

/**
 * Where the run stands with the Director (039): the state, who it waits on, the Director's remarks
 * on a return, and the full decision history.
 */
function RunApprovalPanel({ run }: { run: PayrollRun }) {
  const approval = run.approval;
  if (!approval) {
    if (run.status !== 'draft' || run.isFnf) return null;
    return (
      <p className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
        Not yet sent to the Director. Review the lines, correct anything wrong (each change needs a
        justification), then send it for approval. It can be processed once the Director approves.
      </p>
    );
  }
  const decision = approval.latestDecision;
  const sentBack =
    (approval.state === 'returned' || approval.state === 'rejected') && decision;
  return (
    <section
      aria-label="Director approval"
      className="mb-4 rounded-md border border-gray-200 px-3 py-2 text-sm"
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900">Director approval</span>
        <RunApprovalBadge run={run} />
        {approval.state === 'pending' && (
          <span className="text-gray-600">
            Waiting on {approval.levelLabel ?? 'the Director'}
            {approval.awaitingUserName
              ? ` (${approval.awaitingUserName})`
              : approval.awaitingRoleName
                ? ` (${approval.awaitingRoleName})`
                : ''}
            {' '}— corrections and processing wait for their decision.
          </span>
        )}
        {approval.state === 'approved' && run.status === 'draft' && (
          <span className="text-gray-600">Approved — process the run to freeze these figures.</span>
        )}
        {approval.state === 'abandoned' && (
          <span className="text-gray-600">
            The approval was voided (attendance changed or the run was regenerated). Check the
            figures and send it again.
          </span>
        )}
      </p>
      {sentBack && (
        <div role="alert" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
          <p className="font-medium">
            {approval.state === 'returned' ? 'Returned' : 'Rejected'} by {decision.actorName} ·{' '}
            {dateTimeLabel(decision.decidedAt)}
          </p>
          {decision.reason && <p className="mt-0.5">“{decision.reason}”</p>}
          {approval.state === 'returned' && (
            <p className="mt-1 text-xs">Make the corrections asked for, then send it again.</p>
          )}
        </div>
      )}
      <div className="mt-2">
        <DecisionHistory state={approval} entityType="payroll_run" entityId={run.id} />
      </div>
    </section>
  );
}

export default function PayrollRunDetail({ runId }: { runId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>('lines');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // A run never put into its approval chain: the bank sheet refusal offers to submit it.
  const [unsubmittedRun, setUnsubmittedRun] = useState<string | null>(null);
  // 039: hand corrections — the line being corrected, the line whose history is open, and the
  // "edited only" filter.
  const [editing, setEditing] = useState<PayrollLineItem | null>(null);
  const [historyOf, setHistoryOf] = useState<PayrollLineItem | null>(null);
  const [editedOnly, setEditedOnly] = useState(false);

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

  const sendToDirector = useMutation({
    mutationFn: () => submitPayrollRunForApproval(runId),
    onSuccess: () => {
      setError(null);
      setUnsubmittedRun(null);
      toast.success('Sent to the Director for approval.');
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRun', runId] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: Error) =>
      setError(errorMessage(err, 'Could not send the run to the Director.')),
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
    const edited = editedOnly
      ? lines.filter((line) => line.editedFields.length > 0)
      : lines;
    if (!term) return edited;
    return edited.filter((line) =>
      [line.name, line.employeeCode]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [lines, search, editedOnly]);
  const editedLineCount = lines.filter((line) => line.editedFields.length > 0).length;

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

  const editable = isRunEditable(run);
  const approved = isRunApproved(run);
  const approvalState = run.approval?.state ?? null;

  const lineColumns: Column<PayrollLineItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (line) =>
        line.editedFields.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
              aria-hidden="true"
            />
            {nameOf(line)}
            <span className="sr-only">(changed by hand)</span>
          </span>
        ) : (
          nameOf(line)
        ),
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
        render: (l) => {
          const edited = c.field !== undefined && l.editedFields.includes(c.field);
          // Gross, deductions and net move with a correction without being typed: tinted lighter.
          const derived =
            !edited &&
            l.editedFields.length > 0 &&
            ['gross', 'deductions', 'net'].includes(c.key);
          if (!edited && !derived) return money(c.value(l));
          return (
            <span
              className={edited ? EDITED_CELL : DERIVED_CELL}
              title={edited ? 'Changed by hand' : 'Recalculated after a change'}
            >
              {money(c.value(l))}
              {edited && <span className="sr-only"> (changed by hand)</span>}
            </span>
          );
        },
        sortValue: (l) => c.value(l),
      }),
    ),
  ];

  const exportLines = () =>
    downloadCsv(
      `Payroll_${run.period}_line_items.csv`,
      [
        'Code',
        'Employee',
        'Days paid',
        'LOP',
        ...MONEY_COLUMNS.map((c) => c.header),
        'Changed by hand',
      ],
      visibleLines.map((line) => [
        line.employeeCode ?? '',
        line.name ?? '',
        line.payableDays,
        line.lopDays,
        ...MONEY_COLUMNS.map((c) => c.value(line).toFixed(2)),
        line.editedFields
          .map((f) => MONEY_COLUMNS.find((c) => c.field === f)?.header ?? f)
          .join('; '),
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
              {/* 039: HR sends the reviewed draft to the Director — again after a return. */}
              {editable && (
                <Button
                  type="button"
                  onClick={async () => {
                    if (
                      await confirmDialog({
                        title: 'Send to the Director?',
                        message: `The ${periodLabel(run.period)} payroll goes to the Director for approval${
                          editedLineCount > 0
                            ? `, with ${editedLineCount} line${
                                editedLineCount === 1 ? '' : 's'
                              } changed by hand`
                            : ''
                        }. Lines cannot be changed while the Director has it.`,
                        confirmLabel: 'Send',
                        tone: 'default',
                      })
                    ) {
                      sendToDirector.mutate();
                    }
                  }}
                  loading={sendToDirector.isPending}
                  disabled={discard.isPending || setStatus.isPending}
                >
                  {approvalState === 'returned' ? 'Send again' : 'Send to Director'}
                </Button>
              )}
              {/* Processing freezes the approved figures, so it is offered once the Director has
                  approved. An F&F run, and a run in a company with no payroll chain, keep the old
                  path. */}
              {(approved ||
                run.isFnf ||
                (approvalState === null && !run.approvalRequired)) && (
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
                  disabled={discard.isPending || sendToDirector.isPending}
                >
                  Process run
                </Button>
              )}
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
          {/* 039: the bank sheet only once the Director has approved (and the run is processed);
              the server refuses otherwise, and an F&F run keeps its own gate. */}
          {processed && (approved || run.isFnf) && (
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
      {processed && !approved && !run.isFnf && run.status !== 'paid' && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <span>Bank sheet: waiting for Director approval.</span>
          {approvalState === null && <SubmitRunApproval runId={runId} />}
        </div>
      )}

      <RunApprovalPanel run={run} />

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
          {editedLineCount > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className={EDITED_CELL}>0.00</span> changed by hand
              </span>
              <span className="flex items-center gap-1.5">
                <span className={DERIVED_CELL}>0.00</span> recalculated
              </span>
              <CheckboxField
                id="run-edited-only"
                label={`Changed lines only (${editedLineCount})`}
                checked={editedOnly}
                onChange={(event) => setEditedOnly(event.target.checked)}
              />
            </div>
          )}
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
          actions={
            editable || editedLineCount > 0
              ? (line) => (
                  <div className="flex gap-2">
                    {editable && line.id && (
                      <RowAction type="button" onClick={() => setEditing(line)}>
                        Edit
                      </RowAction>
                    )}
                    {line.editedFields.length > 0 && (
                      <RowAction
                        type="button"
                        intent="read"
                        icon={null}
                        onClick={() => setHistoryOf(line)}
                      >
                        History
                      </RowAction>
                    )}
                  </div>
                )
              : undefined
          }
          emptyMessage={
            search.trim()
              ? 'No employee in this run matches that search.'
              : editedOnly
                ? 'No line in this run has been changed by hand.'
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
              {(editable || editedLineCount > 0) && <td />}
            </tr>
          }
        />
      </TabPanel>

      <TabPanel id="changes" idPrefix="run" active={tab}>
        <RunEditsTable runId={runId} />
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
      {editing && (
        <EditLineModal runId={runId} line={editing} onClose={() => setEditing(null)} />
      )}
      {historyOf && (
        <LineHistoryModal runId={runId} line={historyOf} onClose={() => setHistoryOf(null)} />
      )}
    </main>
  );
}
