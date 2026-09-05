'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadLetter,
  generateLetter,
  getLetters,
  type GeneratedLetter,
} from '@/app/lib/api/recruitment';
import { LETTER_TYPES, recruitmentLabel } from '@/app/lib/constants';
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

export default function LettersPage() {
  const queryClient = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const letters = useQuery({ queryKey: ['letters'], queryFn: () => getLetters() });

  const download = useMutation({
    mutationFn: async (id: string) => {
      const blob = await downloadLetter(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'letter.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not download.'),
  });

  const columns: Column<GeneratedLetter>[] = [
    { key: 'type', header: 'Type', render: (l) => recruitmentLabel(l.letterType) },
    { key: 'subject', header: 'Subject', render: (l) => l.employeeId ?? l.candidateId ?? '—' },
    { key: 'version', header: 'Version', render: (l) => `v${l.version}` },
    {
      key: 'current',
      header: '',
      render: (l) => (l.isSuperseded ? <StatusBadge status="inactive" label="Superseded" /> : <StatusBadge status="active" label="Current" />),
    },
    { key: 'issued', header: 'Issued', render: (l) => l.issuedAt.slice(0, 10) },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Letters</h1>
          <p className="text-sm text-gray-500">Generated letters with version history.</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}>Generate Letter</Button>
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={letters.data ?? []}
        rowKey={(l) => l.id}
        isLoading={letters.isPending}
        error={letters.isError ? 'Could not load letters.' : null}
        emptyMessage="No letters generated yet."
        actions={(l) => <RowAction onClick={() => download.mutate(l.id)}>Download</RowAction>}
      />

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['letters'] });
            setShowGenerate(false);
          }}
        />
      )}
    </div>
  );
}

function GenerateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [letterType, setLetterType] = useState('appointment');
  const [employeeId, setEmployeeId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => generateLetter({ letterType, employeeId }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not generate the letter.'),
  });

  return (
    <Modal
      title="Generate Letter"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button onClick={() => { setError(null); mutation.mutate(); }} disabled={!employeeId}>Generate</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField id="g-type" label="Letter type" value={letterType} onChange={(e) => setLetterType(e.target.value)}>
          {LETTER_TYPES.filter((t) => t !== 'offer').map((t) => (
            <option key={t} value={t}>{recruitmentLabel(t)}</option>
          ))}
        </SelectField>
        <TextField id="g-emp" label="Employee id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
      </div>
    </Modal>
  );
}
