'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  downloadLetter,
  getLetters,
  letterFileName,
  type IssuedLetter,
} from '@/app/lib/api/letters';
import {
  CANDIDATE_LETTER_KIND_KEYS,
  GENERATE_LETTER_COPY,
  LETTER_STATUS_LABELS,
} from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { saveBlob } from '@/app/lib/download-file';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

/**
 * Recruitment's one document: the offer letter to a candidate (2026-10-15). Everything from the
 * appointment letter on — increment, transfer, relieving, … — is HR & Payroll's, issued and listed
 * on the employee's own Letters tab.
 */
const HR_KIND_KEYS: readonly string[] = [...CANDIDATE_LETTER_KIND_KEYS];

/**
 * Every HR document the company has issued, newest first (HR documents, 2026-10-13).
 *
 * Reads `GET /letters` rather than `/recruitment/letters`, because that is the list that carries
 * what this page needs to be useful now: the reference number, the kind's own label (any kind, not
 * feature 011's five) and the approval state. The api already filters it to the kinds the caller
 * may act on; this narrows it to HR kinds, so a work order issued on a project does not appear in
 * Recruitment.
 *
 * Nothing is generated here: an offer letter is issued from its draft offer, on the candidate in
 * the pipeline, which is what moves the offer and the candidate on.
 */
export default function LettersPage() {
  const [error, setError] = useState<string | null>(null);

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
      render: (l) => (l.candidateId ? 'Candidate' : '—'),
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
          description="Offer letters issued to candidates, with their reference numbers. Offer letters are generated from the candidate, on the pipeline board."
        />
      </div>

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={letters.data ?? []}
        rowKey={(l) => l.id}
        isLoading={letters.isPending}
        error={letters.isError ? 'Could not load letters.' : null}
        emptyMessage="No offer letter has been issued yet."
        actions={(l) =>
          l.status === 'composed' ? null : (
            <RowAction intent="read" onClick={() => void download(l)}>
              Download
            </RowAction>
          )
        }
      />
    </div>
  );
}
