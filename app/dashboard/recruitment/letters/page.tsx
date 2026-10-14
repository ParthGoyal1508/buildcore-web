'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { listEmployees } from '@/app/lib/api/hr-payroll';
import {
  downloadLetter,
  getLetters,
  letterFileName,
  type IssuedLetter,
} from '@/app/lib/api/letters';
import {
  CANDIDATE_LETTER_KIND_KEYS,
  RECRUITMENT_EMPLOYEE_LETTER_KIND_KEYS,
  GENERATE_LETTER_COPY,
  LETTER_STATUS_LABELS,
} from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { saveBlob } from '@/app/lib/download-file';
import { Button } from '@/app/ui/button';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import GenerateLetterDialog, {
  useOfferableLetterKinds,
} from '@/app/ui/letters/generate-letter-dialog';
import SearchableSelect from '@/app/ui/searchable-select';
import { FormError, RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

/**
 * Recruitment's documents: the offer to a candidate and the appointment letter on joining. The
 * documents of employment that follow (increment, transfer, relieving, …) are HR's, issued and
 * listed on the employee's own Letters tab.
 */
const HR_KIND_KEYS: readonly string[] = [
  ...CANDIDATE_LETTER_KIND_KEYS,
  ...RECRUITMENT_EMPLOYEE_LETTER_KIND_KEYS,
];

/**
 * Every HR document the company has issued, newest first (HR documents, 2026-10-13).
 *
 * Reads `GET /letters` rather than `/recruitment/letters`, because that is the list that carries
 * what this page needs to be useful now: the reference number, the kind's own label (any kind, not
 * feature 011's five) and the approval state. The api already filters it to the kinds the caller
 * may act on; this narrows it to HR kinds, so a work order issued on a project does not appear in
 * Recruitment.
 *
 * Generating here is the appointment letter, for somebody who has joined: the employee is chosen
 * first because the letter is pre-filled from their new record. The pipeline offers the same
 * letter straight after "Complete Joining".
 */
export default function LettersPage() {
  const [picking, setPicking] = useState(false);
  const [generateFor, setGenerateFor] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = useEmployeeNames();
  const offerable = useOfferableLetterKinds(RECRUITMENT_EMPLOYEE_LETTER_KIND_KEYS);

  const letters = useQuery({
    queryKey: ['letters', { scope: 'hr' }],
    queryFn: () => getLetters(),
    select: (rows) => rows.filter((row) => HR_KIND_KEYS.includes(row.letterKindKey)),
  });

  const download = async (letter: IssuedLetter) => {
    setError(null);
    try {
      saveBlob(await downloadLetter(letter.id), letterFileName(letter));
    } catch {
      setError(GENERATE_LETTER_COPY.downloadFailed);
    }
  };

  const columns: Column<IssuedLetter>[] = [
    {
      key: 'ref',
      header: 'Reference',
      render: (l) => <span className="font-mono text-xs">{l.referenceNo ?? '—'}</span>,
    },
    { key: 'kind', header: 'Document', render: (l) => l.letterKindLabel },
    {
      key: 'to',
      header: 'To',
      render: (l) =>
        l.employeeId ? names.label(l.employeeId) : l.candidateId ? 'Candidate' : '—',
    },
    { key: 'version', header: 'Version', render: (l) => `v${l.version}`, hideOnCard: true },
    {
      key: 'status',
      header: 'Status',
      render: (l) => (
        <StatusBadge
          status={l.status === 'composed' ? 'pending' : 'active'}
          label={LETTER_STATUS_LABELS[l.status]}
        />
      ),
    },
    {
      key: 'issued',
      header: 'Issued',
      render: (l) => (l.issuedAt ? dateLabel(l.issuedAt.toISOString()) : '—'),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <PageHeader
          title="Letters"
          description="HR documents issued to employees and candidates, with their reference numbers."
        />
        {offerable.kinds.length > 0 && (
          <Button intent="read" onClick={() => setPicking(true)}>
            {GENERATE_LETTER_COPY.action}
          </Button>
        )}
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={letters.data ?? []}
        rowKey={(l) => l.id}
        isLoading={letters.isPending}
        error={letters.isError ? 'Could not load letters.' : null}
        emptyMessage="No HR document has been issued yet."
        actions={(l) =>
          l.status === 'composed' ? null : (
            <RowAction intent="read" onClick={() => void download(l)}>
              Download
            </RowAction>
          )
        }
      />

      {picking && (
        <EmployeePicker
          onClose={() => setPicking(false)}
          onPicked={(picked) => {
            setPicking(false);
            setGenerateFor(picked);
          }}
        />
      )}

      {generateFor && (
        <GenerateLetterDialog
          recipient={{ employeeId: generateFor.id }}
          recipientLabel={generateFor.label}
          kindKeys={RECRUITMENT_EMPLOYEE_LETTER_KIND_KEYS}
          initialKindKey="appointment"
          onClose={() => setGenerateFor(null)}
        />
      )}
    </div>
  );
}

/**
 * Choose whom the document is to. A separate step rather than a field in the generate dialog,
 * because the dialog's whole form is pre-filled from the person chosen here.
 */
function EmployeePicker({
  onClose,
  onPicked,
}: {
  onClose: () => void;
  onPicked: (picked: { id: string; label: string }) => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const roster = useQuery({
    queryKey: ['hr', 'employees', { pageSize: 100 }],
    queryFn: () => listEmployees({ pageSize: 100 }),
  });
  const options = (roster.data?.items ?? []).map((e) => ({
    id: e.id,
    label: e.employeeCode,
    sublabel: [e.firstName, e.lastName].filter(Boolean).join(' '),
  }));
  const chosen = options.find((o) => o.id === employeeId);

  return (
    <Modal
      title={GENERATE_LETTER_COPY.title}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            intent="read"
            type="button"
            disabled={!chosen}
            onClick={() =>
              chosen &&
              onPicked({
                id: chosen.id,
                label: chosen.sublabel ? `${chosen.label} · ${chosen.sublabel}` : chosen.label,
              })
            }
          >
            Continue
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-gray-700">Employee</p>
        {roster.isError ? (
          <p className="text-sm text-red-600" role="alert">
            The employee list could not be loaded. Open the employee’s own page and use its
            Letters tab instead.
          </p>
        ) : (
          <SearchableSelect
            value={employeeId}
            onChange={setEmployeeId}
            options={options}
            placeholder={roster.isPending ? 'Loading…' : 'Search by code or name'}
          />
        )}
        <p className="text-xs text-gray-500">
          Offer letters are generated from the candidate, on the pipeline board.
        </p>
      </div>
    </Modal>
  );
}
