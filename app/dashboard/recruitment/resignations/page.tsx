'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  acceptResignation,
  createResignation,
  getResignations,
  withdrawResignation,
  type Resignation,
} from '@/app/lib/api/recruitment';
import { listEmployees } from '@/app/lib/api/hr-payroll';
import { getCurrentUser } from '@/app/lib/api/users';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import {
  RESIGNATION_REASON_CATEGORIES,
  recruitmentLabel,
} from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import AsyncSelect from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { promptDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

export default function ResignationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [accepting, setAccepting] = useState<Resignation | null>(null);
  const toast = useToast();

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const employees = useEmployeeNames();
  const resignations = useQuery({
    queryKey: ['resignations'],
    queryFn: () => getResignations(),
  });
  const canApprove =
    user.data?.permissions.includes('RECRUITMENT_APPROVE') ?? false;
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['resignations'] });

  // 036 H3: one tap withdrew a resignation, with "Withdrawn" sent as the reason the API asks for.
  // It now asks for the real one, and the row's button waits while the request is out.
  const withdraw = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      withdrawResignation(id, reason),
    onSuccess: () => {
      toast.success('Resignation withdrawn');
      return invalidate();
    },
    onError: (e) => toast.error(errorMessage(e, 'Could not withdraw.')),
  });
  const askWithdraw = async (r: Resignation) => {
    const reason = await promptDialog({
      title: 'Withdraw resignation',
      message: `Withdraw the resignation of ${r.employeeName ?? employees.label(r.employeeId)}? They stay on the rolls.`,
      label: 'Reason',
      required: true,
      multiline: true,
      confirmLabel: 'Withdraw',
      tone: 'danger',
    });
    if (reason === null) return;
    withdraw.mutate({ id: r.id, reason: reason.trim() });
  };

  const columns: Column<Resignation>[] = [
    {
      key: 'emp',
      header: 'Employee',
      // Named by the server (2026-10-15); the roster lookup covers an older API.
      render: (r) =>
        r.employeeName
          ? `${r.employeeName}${r.employeeCode ? ` · ${r.employeeCode}` : ''}`
          : employees.label(r.employeeId),
    },
    {
      key: 'date',
      header: 'Resigned',
      render: (r) => (r.resignationDate ? dateLabel(r.resignationDate) : '—'),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => recruitmentLabel(r.reasonCategory),
    },
    {
      key: 'lwd',
      header: 'Last working day',
      render: (r) => {
        const lwd = r.agreedLastWorkingDay ?? r.expectedLastWorkingDay;
        return lwd ? dateLabel(lwd) : '—';
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge status={r.status} label={recruitmentLabel(r.status)} />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <PageHeader
          title="Resignations"
          description="Separations and their last working days."
        />
        <Button onClick={() => setShowForm(true)}>New Resignation</Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={resignations.data ?? []}
        rowKey={(r) => r.id}
        isLoading={resignations.isPending}
        error={resignations.isError ? resignations.error : null}
        onRetry={resignations.refetch}
        emptyMessage="No resignations recorded."
        actions={(r) => (
          <span className="flex gap-2">
            {r.status === 'submitted' && canApprove && (
              <RowAction onClick={() => setAccepting(r)}>Accept</RowAction>
            )}
            {r.status === 'submitted' && (
              <RowAction
                onClick={() => askWithdraw(r)}
                loading={withdraw.isPending && withdraw.variables?.id === r.id}
                disabled={withdraw.isPending}
              >
                Withdraw
              </RowAction>
            )}
          </span>
        )}
      />

      {showForm && (
        <ResignationForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            invalidate();
            setShowForm(false);
          }}
        />
      )}
      {accepting && (
        <AcceptForm
          resignation={accepting}
          onClose={() => setAccepting(null)}
          onSaved={() => {
            invalidate();
            setAccepting(null);
          }}
        />
      )}
    </div>
  );
}

function ResignationForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  // The employee is picked by name or code (2026-10-15), not typed as an id nobody knows.
  // 036 H3: through the server-search picker. The separate search box and select it replaces kept
  // the chosen id when a new search filtered that person out of the list, so Save recorded the
  // resignation against somebody no longer shown on screen; the picker's value is what it shows.
  const [employeeId, setEmployeeId] = useState('');
  const toast = useToast();
  const [resignationDate, setResignationDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState('better_opportunity');
  const [reasonDetail, setReasonDetail] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const expectedLwd =
    resignationDate && noticePeriodDays
      ? new Date(
          new Date(resignationDate).getTime() +
            Number(noticePeriodDays) * 86400000,
        )
          .toISOString()
          .slice(0, 10)
      : null;

  const mutation = useMutation({
    mutationFn: () =>
      createResignation({
        employeeId,
        resignationDate,
        reasonCategory,
        reasonDetail,
        noticePeriodDays: Number(noticePeriodDays),
      }),
    onSuccess: () => {
      toast.success('Resignation recorded');
      onSaved();
    },
    onError: (e) =>
      setError(errorMessage(e, 'Could not record the resignation.')),
  });

  return (
    <Modal
      title="New Resignation"
      onClose={onClose}
      isDirty={Boolean(employeeId || resignationDate || reasonDetail)}
      pending={mutation.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!employeeId || !resignationDate || !reasonDetail.trim()}
            loading={mutation.isPending}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <div>
          <label
            htmlFor="res-emp"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Employee *
          </label>
          <AsyncSelect
            id="res-emp"
            value={employeeId}
            onChange={(id) => setEmployeeId(id)}
            placeholder="Name or code"
            cacheKey={['hr', 'employees', 'active']}
            search={(term, page) =>
              listEmployees({
                search: term || undefined,
                isActive: true,
                page,
                pageSize: 25,
              }).then((r) => ({
                total: r.total,
                items: r.items.map((employee) => ({
                  id: employee.id,
                  label:
                    [employee.firstName, employee.lastName]
                      .filter(Boolean)
                      .join(' ') || employee.employeeCode,
                  note: employee.employeeCode,
                })),
              }))
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="res-date"
            label="Resignation date *"
            type="date"
            value={resignationDate}
            onChange={(e) => setResignationDate(e.target.value)}
          />
          <TextField
            id="res-notice"
            label="Notice period (days)"
            type="number"
            min="0"
            value={noticePeriodDays}
            onChange={(e) => setNoticePeriodDays(e.target.value)}
          />
        </div>
        <SelectField
          id="res-cat"
          label="Reason category"
          value={reasonCategory}
          onChange={(e) => setReasonCategory(e.target.value)}
        >
          {RESIGNATION_REASON_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {recruitmentLabel(c)}
            </option>
          ))}
        </SelectField>
        <TextField
          id="res-detail"
          label="Reason detail *"
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
        />
        {expectedLwd && (
          <p className="text-sm text-gray-600">
            Expected last working day: {dateLabel(expectedLwd)}
          </p>
        )}
      </div>
    </Modal>
  );
}

function AcceptForm({
  resignation,
  onClose,
  onSaved,
}: {
  resignation: Resignation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [agreedLastWorkingDay, setAgreed] = useState('');
  const [noticeWaiverDays, setWaiverDays] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const earlier =
    agreedLastWorkingDay &&
    resignation.expectedLastWorkingDay &&
    agreedLastWorkingDay < resignation.expectedLastWorkingDay;

  const mutation = useMutation({
    mutationFn: () =>
      acceptResignation(resignation.id, {
        agreedLastWorkingDay: agreedLastWorkingDay || undefined,
        noticeWaiverDays: noticeWaiverDays
          ? Number(noticeWaiverDays)
          : undefined,
        waiverReason: waiverReason || undefined,
      }),
    onSuccess: () => {
      toast.success('Resignation accepted');
      onSaved();
    },
    onError: (e) => setError(errorMessage(e, 'Could not accept.')),
  });

  return (
    <Modal
      title="Accept Resignation"
      onClose={onClose}
      pending={mutation.isPending}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!!earlier && (!noticeWaiverDays || !waiverReason)}
            loading={mutation.isPending}
          >
            Accept
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField
          id="ac-lwd"
          label="Agreed last working day"
          type="date"
          value={agreedLastWorkingDay}
          onChange={(e) => setAgreed(e.target.value)}
          hint={`Expected: ${resignation.expectedLastWorkingDay ? dateLabel(resignation.expectedLastWorkingDay) : '—'}`}
        />
        {earlier && (
          <>
            <TextField
              id="ac-waive"
              label="Notice waiver days"
              type="number"
              min="0"
              value={noticeWaiverDays}
              onChange={(e) => setWaiverDays(e.target.value)}
            />
            <TextField
              id="ac-wr"
              label="Waiver reason"
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
            />
          </>
        )}
      </div>
    </Modal>
  );
}
