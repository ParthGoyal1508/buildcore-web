'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deleteNoc,
  getNocFile,
  getNocs,
  uploadNoc,
  type NocSubject,
} from '@/app/lib/api/nocs';
import { saveBlob } from '@/app/lib/download-file';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { toBase64 } from '@/app/ui/plant/document-modal';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { LoadingText } from '@/app/ui/spinner';
import { NocStatusBadge, useNocStatuses } from './noc-status';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * No Objection Certificates for one record — uploaded, listed, opened, saved and removed
 * (2026-10-15). The client: "we just need to give an option of uploading No Objection
 * Certificate" — after a work order or an LOI, on a hire order, for a labour worker, a vendor or
 * a member of staff. One panel for every place, so a NOC reads and works the same wherever it is.
 *
 * The application does not generate NOCs, so there is no number to assign: the issuer, their
 * reference and the date are recorded as written on the certificate.
 */
export default function NocPanel({
  subjectType,
  subjectId,
  stage,
  title = 'No Objection Certificates',
  hint,
}: {
  subjectType: NocSubject;
  subjectId: string;
  stage?: 'loi' | 'work_order';
  title?: string;
  hint?: string;
}) {
  const queryClient = useQueryClient();
  const { show, viewer } = useFileViewer();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = ['nocs', subjectType, subjectId];

  const status = useNocStatuses(subjectType, [subjectId]);

  const nocs = useQuery({
    queryKey: key,
    queryFn: () => getNocs(subjectType, subjectId),
    // A work order's two stages share one list, filtered here.
    select: (rows) =>
      stage ? rows.filter((row) => row.stage === stage) : rows,
  });

  const remove = useMutation({
    mutationFn: deleteNoc,
    // `['nocs']`, not just this list: the record's open/closed status is under it too.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['nocs'] }),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'Could not remove it.'),
  });

  async function open(id: string, save: boolean, name: string | null) {
    setError(null);
    try {
      const file = await getNocFile(id);
      if (save) saveBlob(file.blob, file.filename ?? name ?? 'NOC');
      else show(file, name ?? 'NOC');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not open the NOC.',
      );
    }
  }

  return (
    <section className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
      {viewer}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            {title}
            {/* The LOI's NOC does not close a work order, so its panel shows no status. */}
            {stage !== 'loi' && <NocStatusBadge status={status?.get(subjectId)} />}
          </h4>
          {hint ? (
            <p className="text-xs text-gray-500">{hint}</p>
          ) : stage === 'loi' ? (
            <p className="text-xs text-gray-500">
              The work order stays open until its NOC after the work order is uploaded.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Open until a NOC is uploaded, then closed.
            </p>
          )}
        </div>
        {!adding && (
          <SecondaryButton type="button" onClick={() => setAdding(true)}>
            Upload NOC
          </SecondaryButton>
        )}
      </div>
      <FormError message={error} />

      {adding && (
        <NocForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void queryClient.invalidateQueries({ queryKey: ['nocs'] });
          }}
          subjectType={subjectType}
          subjectId={subjectId}
          stage={stage}
        />
      )}

      {nocs.isPending ? (
        <p className="text-xs text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : nocs.isError ? (
        <p className="text-xs text-red-700" role="alert">
          {nocs.error instanceof ApiError
            ? nocs.error.message
            : 'Could not load the NOCs.'}
        </p>
      ) : nocs.data.length === 0 ? (
        !adding && <p className="text-xs text-gray-500">No NOC uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {nocs.data.map((noc) => (
            <li
              key={noc.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0 text-sm">
                <div className="truncate font-medium text-gray-900">
                  {noc.fileName ?? 'NOC'}
                </div>
                <div className="text-xs text-gray-500">
                  {[
                    noc.issuedBy && `From ${noc.issuedBy}`,
                    noc.referenceNo && `Ref. ${noc.referenceNo}`,
                    noc.issuedOn && dateLabel(noc.issuedOn),
                  ]
                    .filter(Boolean)
                    .join(' · ') || `Uploaded ${dateLabel(noc.createdAt)}`}
                </div>
                {noc.remarks && (
                  <div className="text-xs text-gray-600">{noc.remarks}</div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <RowAction
                  intent="read"
                  onClick={() => void open(noc.id, false, noc.fileName)}
                >
                  Preview
                </RowAction>
                <RowAction
                  intent="read"
                  onClick={() => void open(noc.id, true, noc.fileName)}
                >
                  Download
                </RowAction>
                <RowAction
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (
                      await confirmDialog({
                        title: 'Remove this NOC?',
                        message: 'The uploaded file is deleted with it.',
                        confirmLabel: 'Remove',
                        tone: 'danger',
                      })
                    ) {
                      remove.mutate(noc.id);
                    }
                  }}
                >
                  Remove
                </RowAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NocForm({
  subjectType,
  subjectId,
  stage,
  onCancel,
  onSaved,
}: {
  subjectType: NocSubject;
  subjectId: string;
  stage?: 'loi' | 'work_order';
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [issuedBy, setIssuedBy] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose the NOC file.');
      return uploadNoc({
        subjectType,
        subjectId,
        ...(stage ? { stage } : {}),
        file: await toBase64(file),
        fileName: file.name,
        contentType: file.type || undefined,
        issuedBy: issuedBy.trim() || undefined,
        referenceNo: referenceNo.trim() || undefined,
        issuedOn: issuedOn || undefined,
        remarks: remarks.trim() || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Could not upload it.'),
  });

  const idBase = `noc-${subjectType}-${stage ?? 'all'}`;
  return (
    <div className="space-y-3 rounded-md bg-gray-50 p-3">
      <FormError message={error} />
      <div>
        <label
          htmlFor={`${idBase}-file`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Certificate (PDF or image, up to 10 MB)
        </label>
        <input
          id={`${idBase}-file`}
          type="file"
          accept="application/pdf,image/*"
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm"
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            if (chosen && chosen.size > MAX_BYTES) {
              setError('That file is over 10 MB.');
              setFile(null);
              return;
            }
            setError(null);
            setFile(chosen);
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          id={`${idBase}-by`}
          label="Issued by"
          value={issuedBy}
          onChange={(event) => setIssuedBy(event.target.value)}
          autoComplete="off"
        />
        <TextField
          id={`${idBase}-ref`}
          label="Reference no."
          value={referenceNo}
          onChange={(event) => setReferenceNo(event.target.value)}
          autoComplete="off"
        />
        <TextField
          id={`${idBase}-date`}
          label="Dated"
          type="date"
          value={issuedOn}
          onChange={(event) => setIssuedOn(event.target.value)}
        />
      </div>
      <TextField
        id={`${idBase}-remarks`}
        label="Remarks"
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        autoComplete="off"
      />
      <div className="flex justify-end gap-2">
        <SecondaryButton type="button" onClick={onCancel}>
          Cancel
        </SecondaryButton>
        <Button
          type="button"
          disabled={!file || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </div>
  );
}

/** The panel in a modal, for a list row's "NOC" action. */
export function NocModal({
  subjectType,
  subjectId,
  title,
  onClose,
}: {
  subjectType: NocSubject;
  subjectId: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <NocPanel subjectType={subjectType} subjectId={subjectId} />
    </Modal>
  );
}
