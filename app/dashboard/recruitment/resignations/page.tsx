'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  acceptResignation,
  createResignation,
  getResignations,
  withdrawResignation,
  type Resignation,
} from '@/app/lib/api/recruitment';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  RESIGNATION_REASON_CATEGORIES,
  recruitmentLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
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
import { useCompanyContext } from '@/app/ui/settings/company-context';

export default function ResignationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [accepting, setAccepting] = useState<Resignation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const resignations = useQuery({ queryKey: ['resignations'], queryFn: () => getResignations() });
  const canApprove = user.data?.permissions.includes('RECRUITMENT_APPROVE') ?? false;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['resignations'] });

  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawResignation(id, 'Withdrawn'),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not withdraw.'),
  });

  const columns: Column<Resignation>[] = [
    { key: 'emp', header: 'Employee', render: (r) => r.employeeId },
    { key: 'date', header: 'Resigned', render: (r) => r.resignationDate ?? '—' },
    { key: 'reason', header: 'Reason', render: (r) => recruitmentLabel(r.reasonCategory) },
    { key: 'lwd', header: 'Last working day', render: (r) => r.agreedLastWorkingDay ?? r.expectedLastWorkingDay ?? '—' },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} label={recruitmentLabel(r.status)} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Resignations</h1>
          <p className="text-sm text-gray-500">Separations and their last working days.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>New Resignation</Button>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={resignations.data ?? []}
        rowKey={(r) => r.id}
        isLoading={resignations.isPending}
        error={resignations.isError ? 'Could not load resignations.' : null}
        emptyMessage="No resignations recorded."
        actions={(r) => (
          <span className="flex gap-2">
            {r.status === 'submitted' && canApprove && (
              <RowAction onClick={() => setAccepting(r)}>Accept</RowAction>
            )}
            {r.status === 'submitted' && (
              <RowAction onClick={() => withdraw.mutate(r.id)}>Withdraw</RowAction>
            )}
          </span>
        )}
      />

      {showForm && (
        <ResignationForm onClose={() => setShowForm(false)} onSaved={() => { invalidate(); setShowForm(false); }} />
      )}
      {accepting && (
        <AcceptForm resignation={accepting} onClose={() => setAccepting(null)} onSaved={() => { invalidate(); setAccepting(null); }} />
      )}
    </div>
  );
}

function ResignationForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // The company a cross-company Super Admin has selected; null for everyone else,
  // who is pinned to their own company by the backend anyway.
  const { companyId } = useCompanyContext();
  const [employeeId, setEmployeeId] = useState('');
  const [resignationDate, setResignationDate] = useState('');
  const [reasonCategory, setReasonCategory] = useState('better_opportunity');
  const [reasonDetail, setReasonDetail] = useState('');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [error, setError] = useState<string | null>(null);

  const expectedLwd =
    resignationDate && noticePeriodDays
      ? new Date(new Date(resignationDate).getTime() + Number(noticePeriodDays) * 86400000)
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
        ...(companyId ? { companyId } : {}),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not record the resignation.'),
  });

  return (
    <Modal
      title="New Resignation"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!employeeId || !resignationDate || !reasonDetail}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField id="res-emp" label="Employee id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField id="res-date" label="Resignation date" type="date" value={resignationDate} onChange={(e) => setResignationDate(e.target.value)} />
          <TextField id="res-notice" label="Notice period (days)" type="number" min="0" value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} />
        </div>
        <SelectField id="res-cat" label="Reason category" value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
          {RESIGNATION_REASON_CATEGORIES.map((c) => <option key={c} value={c}>{recruitmentLabel(c)}</option>)}
        </SelectField>
        <TextField id="res-detail" label="Reason detail" value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} />
        {expectedLwd && <p className="text-sm text-gray-600">Expected last working day: {expectedLwd}</p>}
      </div>
    </Modal>
  );
}

function AcceptForm({ resignation, onClose, onSaved }: { resignation: Resignation; onClose: () => void; onSaved: () => void }) {
  const [agreedLastWorkingDay, setAgreed] = useState('');
  const [noticeWaiverDays, setWaiverDays] = useState('');
  const [waiverReason, setWaiverReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const earlier =
    agreedLastWorkingDay &&
    resignation.expectedLastWorkingDay &&
    agreedLastWorkingDay < resignation.expectedLastWorkingDay;

  const mutation = useMutation({
    mutationFn: () =>
      acceptResignation(resignation.id, {
        agreedLastWorkingDay: agreedLastWorkingDay || undefined,
        noticeWaiverDays: noticeWaiverDays ? Number(noticeWaiverDays) : undefined,
        waiverReason: waiverReason || undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not accept.'),
  });

  return (
    <Modal
      title="Accept Resignation"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!!earlier && (!noticeWaiverDays || !waiverReason)}>Accept</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField id="ac-lwd" label="Agreed last working day" type="date" value={agreedLastWorkingDay} onChange={(e) => setAgreed(e.target.value)} hint={`Expected: ${resignation.expectedLastWorkingDay ?? '—'}`} />
        {earlier && (
          <>
            <TextField id="ac-waive" label="Notice waiver days" type="number" min="0" value={noticeWaiverDays} onChange={(e) => setWaiverDays(e.target.value)} />
            <TextField id="ac-wr" label="Waiver reason" value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} />
          </>
        )}
      </div>
    </Modal>
  );
}
