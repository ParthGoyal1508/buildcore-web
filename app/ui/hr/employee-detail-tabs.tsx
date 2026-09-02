'use client';

import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  getEmployee,
  getLeaveBalances,
  listLoans,
  type Loan,
} from '@/app/lib/api/hr-payroll';
import {
  listDepartments,
  listDesignations,
  listShifts,
} from '@/app/lib/api/settings';
import { HR_MESSAGES, ROUTES, hrLabel } from '@/app/lib/constants';
import { dateLabel, money, rupees } from '@/app/lib/format';
import { lusitana } from '@/app/ui/fonts';
import AttendanceCalendar from '@/app/ui/hr/attendance-calendar';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import DocumentsTab from '@/app/ui/hr/documents-tab';
import MaskedField from '@/app/ui/hr/masked-field';
import OffboardingPanel from '@/app/ui/hr/offboarding-panel';
import TransferModal from '@/app/ui/hr/transfer-modal';
import TabStrip, { TabPanel } from '@/app/ui/hr/tab-strip';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'salary', label: 'Salary Structure' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
  { id: 'documents', label: 'Documents' },
  { id: 'loans', label: 'Loans' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** A label/value pair. `<dl>` throughout, so the pairing is structural rather than visual. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children ?? '—'}</dd>
    </div>
  );
}

function Fields({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
  );
}

const orDash = (value: string | null | undefined) =>
  value && value.trim() ? value : '—';

export default function EmployeeDetailTabs({ employeeId }: { employeeId: string }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [transferring, setTransferring] = useState(false);
  const [offboarding, setOffboarding] = useState(false);

  const { data: employee, isLoading, isError } = useQuery({
    queryKey: ['hr', 'employee', employeeId],
    queryFn: () => getEmployee(employeeId),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  const { data: designations } = useQuery({
    queryKey: ['designations'],
    queryFn: () => listDesignations(),
  });
  const { data: shifts } = useQuery({
    queryKey: ['shifts'],
    queryFn: () => listShifts(),
  });

  const { data: balances } = useQuery({
    queryKey: ['hr', 'leaveBalances', employeeId],
    queryFn: () => getLeaveBalances(employeeId),
    enabled: tab === 'leave',
  });

  const { data: loans } = useQuery({
    queryKey: ['hr', 'loans', { employeeId }],
    queryFn: () => listLoans({ employeeId }),
    enabled: tab === 'loans',
  });

  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !employee) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {HR_MESSAGES.employeeLoadFailed}
      </p>
    );
  }

  const name =
    [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() ||
    employee.employeeCode;

  const lookup = (
    list: { id: string; name: string }[] | undefined,
    id: string | null,
  ) => list?.find((entry) => entry.id === id)?.name ?? '—';

  const earnings: [string, number | null][] = [
    ['Basic', employee.basic],
    ['HRA', employee.hra],
    ['Conveyance', employee.conveyanceAllowance],
    ['Site allowance', employee.siteAllowance],
    ['Special allowance', employee.specialAllowance],
  ];
  const grossMonthly = earnings.reduce((sum, [, value]) => sum + (value ?? 0), 0);

  const loanColumns: Column<Loan>[] = [
    { key: 'amount', header: 'Amount', numeric: true, render: (row) => money(row.amount) },
    { key: 'emi', header: 'EMI', numeric: true, render: (row) => money(row.emiAmount) },
    {
      key: 'disbursed',
      header: 'Disbursed',
      render: (row) => dateLabel(row.disbursementDate),
    },
    { key: 'reason', header: 'Reason', render: (row) => orDash(row.reason) },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <main>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} text-2xl`}>{name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {employee.employeeCode} ·{' '}
            <StatusBadge status={employee.isActive ? 'active' : 'closed'} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${ROUTES.hrEmployee(employee.id)}/edit`}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <PencilSquareIcon className="w-4" aria-hidden="true" />
            Edit
          </Link>
          <SecondaryButton type="button" onClick={() => setTransferring(true)}>
            Transfer
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => setOffboarding(true)}>
            Offboard
          </SecondaryButton>
        </div>
      </div>

      <TabStrip tabs={TABS} active={tab} onChange={setTab} idPrefix="employee-detail" />

      <TabPanel id="overview" idPrefix="employee-detail" active={tab}>
        <Fields>
          <Field label="Employee code">{employee.employeeCode}</Field>
          <Field label="Department">{lookup(departments, employee.departmentId)}</Field>
          <Field label="Designation">{lookup(designations, employee.designationId)}</Field>
          <Field label="Employment type">
            {employee.employmentType ? hrLabel(employee.employmentType) : '—'}
          </Field>
          <Field label="Date of joining">{dateLabel(employee.dateOfJoining)}</Field>
          <Field label="Shift">{lookup(shifts, employee.shiftId)}</Field>
          <Field label="Mobile">{orDash(employee.mobile)}</Field>
          <Field label="Email">{orDash(employee.email)}</Field>
          <Field label="Monthly gross">{rupees(grossMonthly)}</Field>
        </Fields>
      </TabPanel>

      <TabPanel id="personal" idPrefix="employee-detail" active={tab}>
        <Fields>
          <Field label="Title">{orDash(employee.title)}</Field>
          <Field label="Date of birth">{dateLabel(employee.dob)}</Field>
          <Field label="Gender">{employee.gender ? hrLabel(employee.gender) : '—'}</Field>
          <Field label="Marital status">
            {employee.maritalStatus ? hrLabel(employee.maritalStatus) : '—'}
          </Field>
          {/* Regulated identifiers: masked, with an audited per-field reveal. */}
          <Field label="Aadhaar">
            <MaskedField
              employeeId={employee.id}
              field="aadhaar"
              maskedValue={employee.aadhaar}
            />
          </Field>
          <Field label="PAN">
            <MaskedField employeeId={employee.id} field="pan" maskedValue={employee.pan} />
          </Field>
        </Fields>

        <h3 className="mt-6 text-sm font-medium text-gray-900">Addresses</h3>
        <div className="mt-2">
          <Fields>
            <Field label="Present">
              {[
                employee.presentAddress,
                employee.presentCity,
                employee.presentState,
                employee.presentPinCode,
              ]
                .filter(Boolean)
                .join(', ') || '—'}
            </Field>
            <Field label="Permanent">
              {[
                employee.permanentAddress,
                employee.permanentCity,
                employee.permanentState,
                employee.permanentPinCode,
              ]
                .filter(Boolean)
                .join(', ') || '—'}
            </Field>
            <Field label="Emergency contact">
              {employee.emergencyContactName
                ? `${employee.emergencyContactName}${
                    employee.emergencyContactRelation
                      ? ` (${employee.emergencyContactRelation})`
                      : ''
                  }${
                    employee.emergencyContactPhone
                      ? ` · ${employee.emergencyContactPhone}`
                      : ''
                  }`
                : '—'}
            </Field>
          </Fields>
        </div>
      </TabPanel>

      <TabPanel id="employment" idPrefix="employee-detail" active={tab}>
        <Fields>
          <Field label="Probation ends">{dateLabel(employee.probationEndDate)}</Field>
          <Field label="Confirmed on">{dateLabel(employee.confirmationDate)}</Field>
          <Field label="Calculation mode">
            {employee.calculationMode ? hrLabel(employee.calculationMode) : '—'}
          </Field>
          <Field label="Hours per day">{employee.hoursPerDay ?? '—'}</Field>
          <Field label="Daily rate">
            {employee.dailyRate === null ? '—' : rupees(employee.dailyRate)}
          </Field>
          <Field label="Muster category">{orDash(employee.musterCategory)}</Field>
          <Field label="Workman ID">{orDash(employee.workmanId)}</Field>
        </Fields>

        <h3 className="mt-6 text-sm font-medium text-gray-900">Letters &amp; onboarding</h3>
        <ul className="mt-2 grid gap-1.5 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ['Offer letter', employee.offerLetterIssued],
              ['Appointment letter', employee.appointmentLetterIssued],
              ['NDA signed', employee.ndaSigned],
              ['ID card', employee.idCardIssued],
              ['Uniform', employee.uniformProvided],
              ['Safety induction', employee.safetyInductionCompleted],
              ['Tools issued', employee.toolsIssued],
              ['Bank verified', employee.bankVerificationDone],
              ['Biometrics enrolled', employee.biometricEnrolled],
              ['Site access', employee.siteAccessGranted],
            ] as [string, boolean][]
          ).map(([label, done]) => (
            <li key={label} className="flex items-center gap-2">
              <span aria-hidden="true">{done ? '✓' : '○'}</span>
              <span>{label}</span>
              <span className="sr-only">{done ? 'done' : 'not done'}</span>
            </li>
          ))}
        </ul>
      </TabPanel>

      <TabPanel id="salary" idPrefix="employee-detail" active={tab}>
        <div className="max-w-md">
          <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {earnings.map(([label, value]) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <dt className="text-gray-600">{label}</dt>
                <dd className="tabular-nums">{money(value)}</dd>
              </div>
            ))}
            <div className="flex justify-between bg-gray-50 px-4 py-2.5 text-sm font-medium">
              <dt>Monthly gross</dt>
              <dd className="tabular-nums">{money(grossMonthly)}</dd>
            </div>
          </dl>
        </div>

        <h3 className="mt-6 text-sm font-medium text-gray-900">Statutory &amp; bank</h3>
        <div className="mt-2">
          <Fields>
            <Field label="PF applicable">{employee.pfApplicable ? 'Yes' : 'No'}</Field>
            <Field label="ESIC applicable">{employee.esicApplicable ? 'Yes' : 'No'}</Field>
            <Field label="PF number">{orDash(employee.pfNumber)}</Field>
            <Field label="ESIC number">{orDash(employee.esicNumber)}</Field>
            <Field label="UAN">
              <MaskedField employeeId={employee.id} field="uan" maskedValue={employee.uan} />
            </Field>
            <Field label="Bank">{orDash(employee.bankName)}</Field>
            <Field label="Branch">{orDash(employee.bankBranch)}</Field>
            <Field label="IFSC">{orDash(employee.ifscCode)}</Field>
            <Field label="Account number">
              <MaskedField
                employeeId={employee.id}
                field="bankAccountNumber"
                maskedValue={employee.bankAccountNumber}
              />
            </Field>
          </Fields>
        </div>
      </TabPanel>

      <TabPanel id="attendance" idPrefix="employee-detail" active={tab}>
        <AttendanceCalendar employeeId={employee.id} />
      </TabPanel>

      <TabPanel id="leave" idPrefix="employee-detail" active={tab}>
        <DataTable
          caption="Leave balances"
          columns={[
            {
              key: 'type',
              header: 'Leave type',
              render: (row) => hrLabel(row.leaveType),
            },
            { key: 'fy', header: 'Financial year', render: (row) => row.financialYear },
            { key: 'opening', header: 'Opening', numeric: true, render: (row) => money(row.opening) },
            { key: 'accrued', header: 'Accrued', numeric: true, render: (row) => money(row.accrued) },
            { key: 'used', header: 'Used', numeric: true, render: (row) => money(row.used) },
            {
              key: 'balance',
              header: 'Balance',
              numeric: true,
              render: (row) =>
                money(row.balance ?? row.opening + row.accrued - row.used),
            },
          ]}
          rows={balances ?? []}
          rowKey={(row) => `${row.leaveType}-${row.financialYear}`}
          emptyMessage="No leave balances have been opened for this employee."
        />
      </TabPanel>

      <TabPanel id="documents" idPrefix="employee-detail" active={tab}>
        <DocumentsTab employeeId={employee.id} />
      </TabPanel>

      <TabPanel id="loans" idPrefix="employee-detail" active={tab}>
        <DataTable
          caption="Loan history"
          columns={loanColumns}
          rows={loans ?? []}
          rowKey={(row) => row.id}
          emptyMessage="This employee has no loans."
        />
      </TabPanel>

      {transferring && (
        <TransferModal employee={employee} onClose={() => setTransferring(false)} />
      )}
      {offboarding && (
        <OffboardingPanel employee={employee} onClose={() => setOffboarding(false)} />
      )}
    </main>
  );
}
