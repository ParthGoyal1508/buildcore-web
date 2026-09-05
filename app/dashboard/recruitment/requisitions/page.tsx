'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  approveRequisition,
  createRequisition,
  deleteRequisition,
  getRequisitions,
  rejectRequisition,
  submitRequisitionForApproval,
  type Requisition,
} from '@/app/lib/api/recruitment';
import { listDepartments, listDesignations } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { REQUISITION_EMPLOYMENT_TYPES, recruitmentLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
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

export default function RequisitionsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [rejecting, setRejecting] = useState<Requisition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => listDepartments() });
  const designations = useQuery({ queryKey: ['designations'], queryFn: () => listDesignations() });
  const requisitions = useQuery({
    queryKey: ['requisitions', status],
    queryFn: () => getRequisitions({ status: status || undefined, pageSize: 200 }),
  });

  const canApprove = user.data?.permissions.includes('RECRUITMENT_APPROVE') ?? false;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requisitions'] });
  const deptName = (id: string) => departments.data?.find((d) => d.id === id)?.name ?? id;
  const desigName = (id: string) => designations.data?.find((d) => d.id === id)?.name ?? id;

  const submit = useMutation({
    mutationFn: (id: string) => submitRequisitionForApproval(id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not submit.'),
  });
  const approve = useMutation({
    mutationFn: (id: string) => approveRequisition(id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not approve.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteRequisition(id),
    onSuccess: invalidate,
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : 'Requisition has candidates — cannot delete.',
      ),
  });

  const columns: Column<Requisition>[] = [
    { key: 'code', header: 'Code', render: (r) => r.requisitionCode },
    { key: 'dept', header: 'Department', render: (r) => deptName(r.departmentId) },
    { key: 'desig', header: 'Designation', render: (r) => desigName(r.designationId) },
    {
      key: 'positions',
      header: 'Positions',
      render: (r) => `${r.filledPositions} / ${r.positionCount}`,
    },
    { key: 'type', header: 'Type', render: (r) => recruitmentLabel(r.employmentType) },
    { key: 'target', header: 'Target', render: (r) => r.targetJoiningDate },
    { key: 'age', header: 'Age', render: (r) => `${r.ageInDays}d`, hideOnCard: true },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} label={recruitmentLabel(r.status)} />,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Requisitions</h1>
          <p className="text-sm text-gray-500">Open positions and their approvals.</p>
        </div>
        <div className="flex items-end gap-2">
          <SelectField id="req-status" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {['draft', 'pending_approval', 'open', 'rejected', 'closed'].map((s) => (
              <option key={s} value={s}>
                {recruitmentLabel(s)}
              </option>
            ))}
          </SelectField>
          <Button onClick={() => setShowForm(true)}>New Requisition</Button>
        </div>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={requisitions.data?.items ?? []}
        rowKey={(r) => r.id}
        isLoading={requisitions.isPending}
        error={requisitions.isError ? 'Could not load requisitions.' : null}
        emptyMessage="No requisitions yet."
        actions={(r) => (
          <span className="flex flex-wrap gap-2">
            {r.status === 'draft' && (
              <>
                <RowAction onClick={() => submit.mutate(r.id)}>Submit</RowAction>
                <RowAction onClick={() => remove.mutate(r.id)}>Delete</RowAction>
              </>
            )}
            {r.status === 'pending_approval' && canApprove && (
              <>
                <RowAction onClick={() => approve.mutate(r.id)}>Approve</RowAction>
                <RowAction onClick={() => setRejecting(r)}>Reject</RowAction>
              </>
            )}
          </span>
        )}
      />

      {showForm && (
        <RequisitionForm
          departments={departments.data ?? []}
          designations={designations.data ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            invalidate();
            setShowForm(false);
          }}
        />
      )}

      {rejecting && (
        <RejectForm
          requisition={rejecting}
          onClose={() => setRejecting(null)}
          onSaved={() => {
            invalidate();
            setRejecting(null);
          }}
        />
      )}
    </div>
  );
}

function RequisitionForm({
  departments,
  designations,
  onClose,
  onSaved,
}: {
  departments: { id: string; name: string }[];
  designations: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // The company a cross-company Super Admin has selected; null for everyone else,
  // who is pinned to their own company by the backend anyway.
  const { companyId } = useCompanyContext();
  const [form, setForm] = useState({
    departmentId: '',
    designationId: '',
    positionCount: '1',
    employmentType: 'permanent',
    targetJoiningDate: '',
    budgetedCtcMin: '',
    budgetedCtcMax: '',
    justification: '',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const ctcInvalid =
    form.budgetedCtcMin && form.budgetedCtcMax && Number(form.budgetedCtcMin) > Number(form.budgetedCtcMax);

  const mutation = useMutation({
    mutationFn: () =>
      createRequisition({
        departmentId: form.departmentId,
        designationId: form.designationId,
        positionCount: Number(form.positionCount),
        employmentType: form.employmentType,
        targetJoiningDate: form.targetJoiningDate,
        budgetedCtcMin: Number(form.budgetedCtcMin),
        budgetedCtcMax: Number(form.budgetedCtcMax),
        justification: form.justification,
        ...(companyId ? { companyId } : {}),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not create.'),
  });

  const valid =
    form.departmentId &&
    form.designationId &&
    form.targetJoiningDate &&
    form.budgetedCtcMin &&
    form.budgetedCtcMax &&
    form.justification &&
    !ctcInvalid;

  return (
    <Modal
      title="New Requisition"
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <SelectField id="r-dept" label="Department" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
          <option value="">Select…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </SelectField>
        <SelectField id="r-desig" label="Designation" value={form.designationId} onChange={(e) => set('designationId', e.target.value)}>
          <option value="">Select…</option>
          {designations.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </SelectField>
        <TextField id="r-count" label="Position count" type="number" min="1" value={form.positionCount} onChange={(e) => set('positionCount', e.target.value)} />
        <SelectField id="r-type" label="Employment type" value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
          {REQUISITION_EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{recruitmentLabel(t)}</option>
          ))}
        </SelectField>
        <TextField id="r-target" label="Target joining date" type="date" value={form.targetJoiningDate} onChange={(e) => set('targetJoiningDate', e.target.value)} />
        <div />
        <TextField id="r-min" label="Budgeted CTC min (₹)" type="number" min="0" value={form.budgetedCtcMin} onChange={(e) => set('budgetedCtcMin', e.target.value)} />
        <TextField
          id="r-max"
          label="Budgeted CTC max (₹)"
          type="number"
          min="0"
          value={form.budgetedCtcMax}
          onChange={(e) => set('budgetedCtcMax', e.target.value)}
          error={ctcInvalid ? 'Max must be at least the minimum' : undefined}
        />
        <div className="sm:col-span-2">
          <TextField id="r-just" label="Justification" value={form.justification} onChange={(e) => set('justification', e.target.value)} />
        </div>
        {form.budgetedCtcMin && form.budgetedCtcMax && !ctcInvalid && (
          <p className="text-xs text-gray-500 sm:col-span-2">
            Budget band: {rupees(Number(form.budgetedCtcMin))} – {rupees(Number(form.budgetedCtcMax))}
          </p>
        )}
      </div>
    </Modal>
  );
}

function RejectForm({
  requisition,
  onClose,
  onSaved,
}: {
  requisition: Requisition;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => rejectRequisition(requisition.id, reason),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not reject.'),
  });
  return (
    <Modal
      title={`Reject ${requisition.requisitionCode}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => mutation.mutate()} disabled={!reason}>Reject</Button>
        </div>
      }
    >
      <FormError message={error} />
      <TextField id="rej-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
