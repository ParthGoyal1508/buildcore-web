'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  acceptOffer,
  createOffer,
  declineOffer,
  generateOffer,
  getOffers,
  type Offer,
} from '@/app/lib/api/recruitment';
import { listDepartments, listDesignations } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { recruitmentLabel } from '@/app/lib/constants';
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
import StatusBadge from '@/app/ui/status-badge';

interface Row {
  name: string;
  monthlyAmount: string;
}

export default function OfferModal({
  candidateId,
  onClose,
}: {
  candidateId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => listDepartments() });
  const designations = useQuery({ queryKey: ['designations'], queryFn: () => listDesignations() });
  const offers = useQuery({ queryKey: ['offers', candidateId], queryFn: () => getOffers(candidateId) });
  const canApprove = user.data?.permissions.includes('RECRUITMENT_APPROVE') ?? false;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['offers', candidateId] });

  const [designationId, setDesignationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [offeredCtc, setOfferedCtc] = useState('');
  const [proposedJoiningDate, setProposedJoiningDate] = useState('');
  const [probationMonths, setProbationMonths] = useState('6');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [reportingManagerEmployeeId, setReportingManagerEmployeeId] = useState('');
  const [rows, setRows] = useState<Row[]>([{ name: 'Basic', monthlyAmount: '' }]);

  const total = rows.reduce((s, r) => s + (Number(r.monthlyAmount) || 0), 0);
  const target = offeredCtc ? Number(offeredCtc) / 12 : 0;
  const variance = Math.round((total - target) * 100) / 100;
  const reconciles = offeredCtc !== '' && Math.abs(variance) <= 1;

  const create = useMutation({
    mutationFn: () =>
      createOffer(candidateId, {
        designationId,
        departmentId,
        offeredCtc: Number(offeredCtc),
        salaryBreakup: rows
          .filter((r) => r.name && r.monthlyAmount)
          .map((r) => ({ name: r.name, monthlyAmount: Number(r.monthlyAmount) })),
        proposedJoiningDate,
        probationMonths: Number(probationMonths),
        noticePeriodDays: Number(noticePeriodDays),
        reportingManagerEmployeeId,
      }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not create the offer.'),
  });
  const generate = useMutation({
    mutationFn: (id: string) => generateOffer(id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not generate the offer letter.'),
  });
  const accept = useMutation({
    mutationFn: (id: string) => acceptOffer(id, { acceptedOn: new Date().toISOString().slice(0, 10) }),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not accept.'),
  });
  const decline = useMutation({
    mutationFn: (id: string) => declineOffer(id, 'Declined'),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not decline.'),
  });

  const outsideBudget = offers.data?.some((o) => o.outsideBudget && o.status === 'draft');

  const valid =
    designationId && departmentId && offeredCtc && proposedJoiningDate && reportingManagerEmployeeId && reconciles;

  return (
    <Modal title="Offer" onClose={onClose} wide>
      <div className="space-y-4">
        <FormError message={error} />

        {offers.data && offers.data.length > 0 && (
          <div className="rounded-md border border-gray-100 p-3">
            <p className="mb-2 text-sm font-medium text-gray-700">Existing offers</p>
            <ul className="space-y-1 text-sm">
              {offers.data.map((o: Offer) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span>
                    {rupees(o.offeredCtc)} <StatusBadge status={o.status} label={recruitmentLabel(o.status)} />
                    {o.outsideBudget && <span className="ml-1 text-xs text-amber-800">outside budget</span>}
                  </span>
                  <span className="flex gap-1">
                    {o.status === 'draft' && (
                      <RowAction
                        onClick={() => generate.mutate(o.id)}
                        disabled={o.outsideBudget && !canApprove}
                        title={o.outsideBudget && !canApprove ? 'Needs approval to issue' : undefined}
                      >
                        Generate Letter
                      </RowAction>
                    )}
                    {o.status === 'issued' && (
                      <>
                        <RowAction onClick={() => accept.mutate(o.id)}>Accept</RowAction>
                        <RowAction onClick={() => decline.mutate(o.id)}>Decline</RowAction>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField id="o-desig" label="Designation" value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
            <option value="">Select…</option>
            {designations.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <SelectField id="o-dept" label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select…</option>
            {departments.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
          <TextField id="o-ctc" label="Offered CTC (annual ₹)" type="number" min="0" value={offeredCtc} onChange={(e) => setOfferedCtc(e.target.value)} />
          <TextField id="o-mgr" label="Reporting manager (employee id)" value={reportingManagerEmployeeId} onChange={(e) => setReportingManagerEmployeeId(e.target.value)} />
          <TextField id="o-join" label="Proposed joining date" type="date" value={proposedJoiningDate} onChange={(e) => setProposedJoiningDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="o-prob" label="Probation (months)" type="number" min="0" value={probationMonths} onChange={(e) => setProbationMonths(e.target.value)} />
            <TextField id="o-notice" label="Notice (days)" type="number" min="0" value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} />
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Salary components (monthly)</p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
                  placeholder="Component"
                  value={r.name}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="h-10 w-40 rounded-lg border border-gray-200 px-3 text-sm"
                  type="number"
                  min="0"
                  placeholder="Amount"
                  value={r.monthlyAmount}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, monthlyAmount: e.target.value } : x)))}
                />
                <SecondaryButton onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</SecondaryButton>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <SecondaryButton onClick={() => setRows((rs) => [...rs, { name: '', monthlyAmount: '' }])}>
              Add component
            </SecondaryButton>
            <p className={`text-sm ${reconciles ? 'text-gray-600' : 'text-red-600'}`}>
              Total {rupees(total)} · target {rupees(target)} · variance {rupees(variance)}
            </p>
          </div>
        </div>

        {outsideBudget && (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
            An offer is outside the requisition budget — issuing needs the approve permission.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <Button
            onClick={() => { setError(null); create.mutate(); }}
            disabled={!valid}
            title={!reconciles ? 'Salary breakup must reconcile to the monthly CTC' : undefined}
          >
            Create Offer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
