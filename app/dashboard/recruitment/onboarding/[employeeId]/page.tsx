'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  completeInduction,
  getOnboarding,
  issueKitItem,
  verifyOnboardingDocument,
  waiveOnboardingItem,
  type Onboarding,
} from '@/app/lib/api/recruitment';
import { getCurrentUser } from '@/app/lib/api/users';
import { recruitmentLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import StatusBadge from '@/app/ui/status-badge';

type Item = Onboarding['items'][number];

export default function OnboardingPage() {
  const params = useParams<{ employeeId: string }>();
  const employeeId = params.employeeId;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<Item | null>(null);
  const [waiving, setWaiving] = useState<Item | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const onboarding = useQuery({
    queryKey: ['onboarding', employeeId],
    queryFn: () => getOnboarding(employeeId),
  });
  const canApprove = user.data?.permissions.includes('RECRUITMENT_APPROVE') ?? false;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['onboarding', employeeId] });

  const issue = useMutation({
    mutationFn: (id: string) => issueKitItem(id, 1),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not issue.'),
  });
  const induct = useMutation({
    mutationFn: (id: string) => completeInduction(id),
    onSuccess: invalidate,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not complete.'),
  });

  if (onboarding.isPending) return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  if (onboarding.isError || !onboarding.data)
    return <p className="p-4 text-sm text-red-600">Could not load onboarding.</p>;

  const data = onboarding.data;
  const groups: Record<string, Item[]> = {
    document: data.items.filter((i) => i.itemType === 'document'),
    kit: data.items.filter((i) => i.itemType === 'kit'),
    induction: data.items.filter((i) => i.itemType === 'induction'),
  };
  const groupTitle: Record<string, string> = { document: 'Documents', kit: 'Kit', induction: 'Induction' };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Onboarding</h1>
        <p className="text-sm text-gray-500">
          {data.completedCount} of {data.totalCount} items complete
          {data.onboardingComplete && data.completedAt
            ? ` · completed ${data.completedAt.slice(0, 10)}`
            : ''}
        </p>
      </div>

      {data.onboardingComplete && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Onboarding complete.
        </div>
      )}

      <FormError message={error} />

      {(['document', 'kit', 'induction'] as const).map((type) => (
        <section key={type}>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{groupTitle[type]}</h2>
          <div className="space-y-2">
            {groups[type].map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm">
                <span>{i.label}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={i.status} label={recruitmentLabel(i.status)} />
                  {i.status === 'pending' && type === 'document' && (
                    <RowAction onClick={() => setVerifying(i)}>Verify</RowAction>
                  )}
                  {i.status === 'pending' && type === 'kit' && (
                    <RowAction onClick={() => issue.mutate(i.id)}>Issue</RowAction>
                  )}
                  {i.status === 'pending' && type === 'induction' && (
                    <RowAction onClick={() => induct.mutate(i.id)}>Complete</RowAction>
                  )}
                  {i.status === 'pending' && canApprove && (
                    <RowAction onClick={() => setWaiving(i)}>Waive</RowAction>
                  )}
                </span>
              </div>
            ))}
            {groups[type].length === 0 && <p className="text-sm text-gray-400">None.</p>}
          </div>
        </section>
      ))}

      {verifying && (
        <VerifyModal
          item={verifying}
          onClose={() => setVerifying(null)}
          onSaved={() => { invalidate(); setVerifying(null); }}
        />
      )}
      {waiving && (
        <WaiveModal
          item={waiving}
          onClose={() => setWaiving(null)}
          onSaved={() => { invalidate(); setWaiving(null); }}
        />
      )}
    </div>
  );
}

function VerifyModal({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [documentNumber, setDocumentNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('A file is required');
      return verifyOnboardingDocument(item.id, {
        documentNumber: documentNumber || undefined,
        expiryDate: expiryDate || undefined,
        file,
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not verify the document.'),
  });

  return (
    <Modal
      title={`Verify — ${item.label}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!file}>Verify</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField id="v-num" label="Document number" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
        <TextField id="v-exp" label="Expiry (optional)" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">File</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
    </Modal>
  );
}

function WaiveModal({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => waiveOnboardingItem(item.id, reason),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not waive.'),
  });
  return (
    <Modal
      title={`Waive — ${item.label}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!reason}>Waive</Button>
        </div>
      }
    >
      <FormError message={error} />
      <TextField id="w-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
