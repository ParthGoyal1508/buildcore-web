'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createCandidate,
  getCandidate,
  getCandidates,
  getRequisitions,
  markNoShow,
  rejectCandidate,
  transitionStage,
  type Candidate,
  type CandidateDetail,
} from '@/app/lib/api/recruitment';
import {
  CANDIDATE_SOURCES,
  PIPELINE_COLUMNS,
  recruitmentLabel,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import JoinModal from '@/app/ui/recruitment/join-modal';
import OfferModal from '@/app/ui/recruitment/offer-modal';
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

/** Manual forward transitions the board offers (mirrors the backend machine). */
const NEXT_STAGE: Record<string, string | undefined> = {
  applied: 'shortlisted',
  shortlisted: 'interviewing',
  interviewing: 'selected',
};

export default function PipelinePage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
      <PipelineInner />
    </Suspense>
  );
}

function PipelineInner() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const stageParam = searchParams.get('stage') ?? '';
  const [view, setView] = useState<'table' | 'board'>('table');
  const [showForm, setShowForm] = useState(false);
  const [drawer, setDrawer] = useState<Candidate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = useQuery({
    queryKey: ['candidates', stageParam],
    queryFn: () => getCandidates({ stage: stageParam || undefined }),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['candidates'] });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => transitionStage(id, stage),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not move the candidate.'),
  });

  const items = candidates.data?.items ?? [];

  const columns: Column<Candidate>[] = [
    { key: 'name', header: 'Name', render: (c) => c.fullName },
    { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—', hideOnCard: true },
    { key: 'email', header: 'Email', render: (c) => c.email ?? '—', hideOnCard: true },
    { key: 'exp', header: 'Exp (y)', render: (c) => c.totalExperienceYears },
    { key: 'source', header: 'Source', render: (c) => recruitmentLabel(c.source) },
    {
      key: 'stage',
      header: 'Stage',
      render: (c) => (
        <span className="flex items-center gap-1">
          <StatusBadge status={c.stage} label={recruitmentLabel(c.stage)} />
          {c.noShow && <StatusBadge status="overdue" label="No-show risk" />}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">
            Candidates through Interviews, Selected and Joining Pending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button
              className={`rounded-md px-3 py-1 text-sm ${view === 'table' ? 'bg-gray-100 font-medium' : ''}`}
              onClick={() => setView('table')}
            >
              Table
            </button>
            <button
              className={`rounded-md px-3 py-1 text-sm ${view === 'board' ? 'bg-gray-100 font-medium' : ''}`}
              onClick={() => setView('board')}
            >
              Board
            </button>
          </div>
          <Button onClick={() => setShowForm(true)}>New Candidate</Button>
        </div>
      </div>

      <FormError message={error} />

      {view === 'table' ? (
        <ResponsiveList
          columns={columns}
          rows={items}
          rowKey={(c) => c.id}
          isLoading={candidates.isPending}
          error={candidates.isError ? 'Could not load candidates.' : null}
          emptyMessage="No candidates match this filter."
          actions={(c) => (
            <span className="flex gap-2">
              {NEXT_STAGE[c.stage] && (
                <RowAction onClick={() => move.mutate({ id: c.id, stage: NEXT_STAGE[c.stage]! })}>
                  → {recruitmentLabel(NEXT_STAGE[c.stage])}
                </RowAction>
              )}
              <RowAction onClick={() => setDrawer(c)}>Open</RowAction>
            </span>
          )}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {PIPELINE_COLUMNS.map((stage) => {
            const columnItems = items.filter((c) => c.stage === stage);
            return (
              <div key={stage} className="min-w-[220px] flex-1 rounded-lg bg-gray-50 p-2">
                <p className="mb-2 px-1 text-xs font-semibold uppercase text-gray-500">
                  {recruitmentLabel(stage)} ({columnItems.length})
                </p>
                <div className="space-y-2">
                  {columnItems.map((c) => (
                    <div key={c.id} className="rounded-md bg-white p-2 shadow-sm">
                      <p className="text-sm font-medium text-gray-900">{c.fullName}</p>
                      <p className="text-xs text-gray-500">{recruitmentLabel(c.source)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <button className="text-xs text-blue-600" onClick={() => setDrawer(c)}>
                          Open
                        </button>
                        {NEXT_STAGE[c.stage] && (
                          <button
                            className="text-xs text-blue-600"
                            onClick={() => move.mutate({ id: c.id, stage: NEXT_STAGE[c.stage]! })}
                          >
                            → {recruitmentLabel(NEXT_STAGE[c.stage])}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CandidateForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            invalidate();
            setShowForm(false);
          }}
        />
      )}

      {drawer && (
        <CandidateDrawer
          candidate={drawer}
          onClose={() => setDrawer(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function CandidateForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // The company a cross-company Super Admin has selected; null for everyone else,
  // who is pinned to their own company by the backend anyway.
  const { companyId } = useCompanyContext();
  const requisitions = useQuery({
    queryKey: ['requisitions', 'open'],
    queryFn: () => getRequisitions({ status: 'open', pageSize: 200 }),
  });
  const [form, setForm] = useState({
    requisitionId: '',
    fullName: '',
    phone: '',
    email: '',
    totalExperienceYears: '',
    currentEmployer: '',
    currentCtc: '',
    expectedCtc: '',
    source: 'portal',
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () =>
      createCandidate({
        requisitionId: form.requisitionId,
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        totalExperienceYears: Number(form.totalExperienceYears || 0),
        currentEmployer: form.currentEmployer || undefined,
        currentCtc: form.currentCtc ? Number(form.currentCtc) : undefined,
        expectedCtc: form.expectedCtc ? Number(form.expectedCtc) : undefined,
        source: form.source,
        ...(companyId ? { companyId } : {}),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not add the candidate.'),
  });

  const valid = form.requisitionId && form.fullName && form.phone && form.email;

  return (
    <Modal
      title="New Candidate"
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!valid}>Save</Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <SelectField id="c-req" label="Requisition" value={form.requisitionId} onChange={(e) => set('requisitionId', e.target.value)}>
          <option value="">Select…</option>
          {requisitions.data?.items.map((r) => (
            <option key={r.id} value={r.id}>{r.requisitionCode}</option>
          ))}
        </SelectField>
        <SelectField id="c-src" label="Source" value={form.source} onChange={(e) => set('source', e.target.value)}>
          {CANDIDATE_SOURCES.map((s) => <option key={s} value={s}>{recruitmentLabel(s)}</option>)}
        </SelectField>
        <TextField id="c-name" label="Full name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
        <TextField id="c-phone" label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <TextField id="c-email" label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <TextField id="c-exp" label="Experience (years)" type="number" min="0" step="0.1" value={form.totalExperienceYears} onChange={(e) => set('totalExperienceYears', e.target.value)} />
        <TextField id="c-emp" label="Current employer" value={form.currentEmployer} onChange={(e) => set('currentEmployer', e.target.value)} />
        <TextField id="c-cctc" label="Current CTC (₹)" type="number" min="0" value={form.currentCtc} onChange={(e) => set('currentCtc', e.target.value)} />
        <TextField id="c-ectc" label="Expected CTC (₹)" type="number" min="0" value={form.expectedCtc} onChange={(e) => set('expectedCtc', e.target.value)} />
      </div>
    </Modal>
  );
}

function CandidateDrawer({
  candidate,
  onClose,
  onChanged,
}: {
  candidate: Candidate;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [revealed, setRevealed] = useState<CandidateDetail | null>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reveal = useMutation({
    mutationFn: () => getCandidate(candidate.id),
    onSuccess: (d) => setRevealed(d),
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not reveal details.'),
  });
  const reject = useMutation({
    mutationFn: () => rejectCandidate(candidate.id, 'Rejected'),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not reject.'),
  });
  const noShow = useMutation({
    mutationFn: () => markNoShow(candidate.id, 'No show'),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not mark no-show.'),
  });

  if (showOffer) return <OfferModal candidateId={candidate.id} onClose={() => setShowOffer(false)} />;
  if (showJoin)
    return (
      <JoinModal
        candidateId={candidate.id}
        candidateName={candidate.fullName}
        onClose={() => setShowJoin(false)}
        onJoined={onChanged}
      />
    );

  return (
    <Modal title={candidate.fullName} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <FormError message={error} />
        <p>
          Stage: <StatusBadge status={candidate.stage} label={recruitmentLabel(candidate.stage)} />
        </p>
        <div className="rounded-md border border-gray-100 p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">Contact details</span>
            {!revealed && (
              <SecondaryButton onClick={() => reveal.mutate()}>Reveal contact details</SecondaryButton>
            )}
          </div>
          <dl className="mt-2 space-y-1">
            <div className="flex gap-2">
              <dt className="w-24 text-gray-500">Phone</dt>
              <dd>{revealed ? revealed.phone : candidate.phone ?? '—'}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 text-gray-500">Email</dt>
              <dd>{revealed ? revealed.email : candidate.email ?? '—'}</dd>
            </div>
            {revealed && (
              <>
                <div className="flex gap-2">
                  <dt className="w-24 text-gray-500">Current CTC</dt>
                  <dd>{revealed.currentCtc ?? '—'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 text-gray-500">Expected CTC</dt>
                  <dd>{revealed.expectedCtc ?? '—'}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">
          {candidate.stage === 'selected' && (
            <Button onClick={() => setShowOffer(true)}>Build Offer</Button>
          )}
          {candidate.stage === 'offer_issued' && (
            <SecondaryButton onClick={() => setShowOffer(true)}>Manage Offer</SecondaryButton>
          )}
          {candidate.stage === 'offer_accepted' && (
            <>
              <Button onClick={() => setShowJoin(true)}>Complete Joining</Button>
              <SecondaryButton onClick={() => noShow.mutate()}>Mark No-show</SecondaryButton>
            </>
          )}
          {candidate.stage !== 'joined' && candidate.stage !== 'rejected' && (
            <SecondaryButton onClick={() => reject.mutate()}>Reject</SecondaryButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
