'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  acceptOffer,
  createOffer,
  declineOffer,
  getOffers,
  type Offer,
} from '@/app/lib/api/recruitment';
import { listDepartments, listDesignations } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  CANDIDATE_LETTER_KIND_KEYS,
  recruitmentLabel,
} from '@/app/lib/constants';
import { rupees, todayIso } from '@/app/lib/format';
import GenerateLetterDialog from '@/app/ui/letters/generate-letter-dialog';
import { offerLetterSubmit } from '@/app/ui/recruitment/offer-letter-submit';
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
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';

interface Row {
  name: string;
  monthlyAmount: string;
}

export default function OfferModal({
  candidateId,
  candidateName,
  onClose,
}: {
  candidateId: string;
  candidateName?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  const designations = useQuery({
    queryKey: ['designations'],
    queryFn: () => listDesignations(),
  });
  const offers = useQuery({
    queryKey: ['offers', candidateId],
    queryFn: () => getOffers(candidateId),
  });
  const canApprove =
    user.data?.permissions.includes('RECRUITMENT_APPROVE') ?? false;
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['offers', candidateId] });
    // Generating an offer issues its letter, which the candidate's letter list shows.
    void queryClient.invalidateQueries({ queryKey: ['letters'] });
    // Issuing, accepting and declining each move the candidate's stage.
    void queryClient.invalidateQueries({ queryKey: ['candidates'] });
    void queryClient.invalidateQueries({
      queryKey: ['candidate-timeline', candidateId],
    });
  };

  const [designationId, setDesignationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [offeredCtc, setOfferedCtc] = useState('');
  const [proposedJoiningDate, setProposedJoiningDate] = useState('');
  const [probationMonths, setProbationMonths] = useState('6');
  const [noticePeriodDays, setNoticePeriodDays] = useState('30');
  const [reportingManagerEmployeeId, setReportingManagerEmployeeId] =
    useState('');
  const employees = useEmployeeNames();
  const [rows, setRows] = useState<Row[]>([
    { name: 'Basic', monthlyAmount: '' },
  ]);
  const [created, setCreated] = useState(false);
  // A draft is revised by creating a new offer, which supersedes it (the server's rule) — so the
  // form is put away while one exists, and taken out only when someone means to replace it.
  const [revising, setRevising] = useState(false);
  const resetForm = () => {
    setDesignationId('');
    setDepartmentId('');
    setOfferedCtc('');
    setProposedJoiningDate('');
    setProbationMonths('6');
    setNoticePeriodDays('30');
    setReportingManagerEmployeeId('');
    setRows([{ name: 'Basic', monthlyAmount: '' }]);
  };

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
          .map((r) => ({
            name: r.name,
            monthlyAmount: Number(r.monthlyAmount),
          })),
        proposedJoiningDate,
        probationMonths: Number(probationMonths),
        noticePeriodDays: Number(noticePeriodDays),
        reportingManagerEmployeeId,
      }),
    onSuccess: () => {
      invalidate();
      // Cleared and put away, so a second press cannot file the same offer again.
      resetForm();
      setRevising(false);
      setCreated(true);
    },
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : 'Could not create the offer.',
      ),
  });
  // The offer whose letter is being generated. The letter form replaces this modal rather than
  // stacking on it — two modals would both close on one Escape.
  const [generating, setGenerating] = useState<Offer | null>(null);
  const accept = useMutation({
    mutationFn: (id: string) =>
      acceptOffer(id, { acceptedOn: todayIso() }),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not accept.'),
  });
  const decline = useMutation({
    mutationFn: (id: string) => declineOffer(id, 'Declined'),
    onSuccess: invalidate,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not decline.'),
  });

  const outsideBudget = offers.data?.some(
    (o) => o.outsideBudget && o.status === 'draft',
  );
  const hasDraft = offers.data?.some((o) => o.status === 'draft') ?? false;
  // Once issued the candidate has left Selected, and an offer can only be made to a Selected
  // candidate: what is left is recording their answer.
  const hasIssued =
    offers.data?.some(
      (o) => o.status === 'issued' || o.status === 'accepted',
    ) ?? false;
  const showForm = offers.isSuccess && !hasIssued && (!hasDraft || revising);

  const valid =
    designationId &&
    departmentId &&
    offeredCtc &&
    proposedJoiningDate &&
    reportingManagerEmployeeId &&
    reconciles;

  if (generating) {
    return (
      <GenerateLetterDialog
        recipient={{ candidateId }}
        recipientLabel={candidateName}
        kindKeys={CANDIDATE_LETTER_KIND_KEYS}
        initialKindKey="offer"
        submit={offerLetterSubmit(generating.id, candidateId)}
        // The candidate moves to Offer Issued with the offer; `invalidate` refreshes both.
        onIssued={invalidate}
        onClose={() => setGenerating(null)}
      />
    );
  }

  return (
    <Modal title="Offer" onClose={onClose} wide>
      <div className="space-y-4">
        <FormError message={error} />

        {offers.data && offers.data.length > 0 && (
          <div className="rounded-md border border-gray-100 p-3">
            <p className="mb-2 text-sm font-medium text-gray-700">
              Existing offers
            </p>
            <ul className="space-y-1 text-sm">
              {offers.data.map((o: Offer) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {rupees(o.offeredCtc)}{' '}
                    <StatusBadge
                      status={o.status}
                      label={recruitmentLabel(o.status)}
                    />
                    {o.outsideBudget && (
                      <span className="ml-1 text-xs text-amber-800">
                        outside budget
                      </span>
                    )}
                  </span>
                  <span className="flex gap-1">
                    {o.status === 'draft' && (
                      <RowAction
                        onClick={() => setGenerating(o)}
                        disabled={o.outsideBudget && !canApprove}
                        title={
                          o.outsideBudget && !canApprove
                            ? 'Needs approval to issue'
                            : undefined
                        }
                      >
                        Generate Letter
                      </RowAction>
                    )}
                    {o.status === 'issued' && (
                      <>
                        <RowAction onClick={() => accept.mutate(o.id)}>
                          Accept
                        </RowAction>
                        <RowAction onClick={() => decline.mutate(o.id)}>
                          Decline
                        </RowAction>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {created && !showForm && (
          <p
            className="rounded bg-green-50 px-2 py-1 text-sm text-green-800"
            role="status"
          >
            Offer created as a draft. Generate its letter above to issue it.
          </p>
        )}
        {hasIssued && (
          <p className="text-sm text-gray-600">
            The offer has been issued. Record the candidate&rsquo;s answer
            above.
          </p>
        )}
        {hasDraft && !hasIssued && !revising && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            <span>
              A draft offer exists. Generate its letter, or revise it — a
              revision replaces the draft.
            </span>
            <SecondaryButton
              onClick={() => {
                setCreated(false);
                setRevising(true);
              }}
            >
              Revise offer
            </SecondaryButton>
          </div>
        )}

        {showForm && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField
                id="o-desig"
                label="Designation"
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
              >
                <option value="">Select…</option>
                {designations.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SelectField>
              <SelectField
                id="o-dept"
                label="Department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">Select…</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="o-ctc"
                label="Offered CTC (annual ₹)"
                type="number"
                min="0"
                value={offeredCtc}
                onChange={(e) => setOfferedCtc(e.target.value)}
              />
              {/* The existing employee the new hire reports to — the offer letter prints their name
                and mobile. Chosen from the roster, not typed: nobody knows an employee's id. */}
              <SelectField
                id="o-mgr"
                label="Reporting manager"
                value={reportingManagerEmployeeId}
                onChange={(e) => setReportingManagerEmployeeId(e.target.value)}
                hint={
                  employees.isError
                    ? 'Could not load employees. Try again, or ask HR.'
                    : undefined
                }
              >
                <option value="">Select…</option>
                {employees.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </SelectField>
              <TextField
                id="o-join"
                label="Proposed joining date"
                type="date"
                value={proposedJoiningDate}
                onChange={(e) => setProposedJoiningDate(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  id="o-prob"
                  label="Probation (months)"
                  type="number"
                  min="0"
                  value={probationMonths}
                  onChange={(e) => setProbationMonths(e.target.value)}
                />
                <TextField
                  id="o-notice"
                  label="Notice (days)"
                  type="number"
                  min="0"
                  value={noticePeriodDays}
                  onChange={(e) => setNoticePeriodDays(e.target.value)}
                />
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                Salary components (monthly)
              </p>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-sm"
                      placeholder="Component"
                      value={r.name}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <input
                      className="h-10 w-40 rounded-lg border border-gray-200 px-3 text-sm"
                      type="number"
                      min="0"
                      placeholder="Amount"
                      value={r.monthlyAmount}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, j) =>
                            j === i
                              ? { ...x, monthlyAmount: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                    <SecondaryButton
                      onClick={() =>
                        setRows((rs) => rs.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </SecondaryButton>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <SecondaryButton
                  onClick={() =>
                    setRows((rs) => [...rs, { name: '', monthlyAmount: '' }])
                  }
                >
                  Add component
                </SecondaryButton>
                <p
                  className={`text-sm ${reconciles ? 'text-gray-600' : 'text-red-600'}`}
                >
                  Total {rupees(total)} · target {rupees(target)} · variance{' '}
                  {rupees(variance)}
                </p>
              </div>
            </div>
          </>
        )}

        {outsideBudget && (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
            An offer is outside the requisition budget — issuing needs the
            approve permission.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          {showForm && (
            <Button
              onClick={() => {
                setError(null);
                create.mutate();
              }}
              disabled={!valid || create.isPending}
              title={
                !reconciles
                  ? 'Salary breakup must reconcile to the monthly CTC'
                  : undefined
              }
            >
              {create.isPending
                ? 'Creating…'
                : revising
                  ? 'Replace draft offer'
                  : 'Create Offer'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
