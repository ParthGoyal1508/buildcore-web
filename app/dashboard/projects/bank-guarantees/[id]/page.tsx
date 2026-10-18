'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  type BankGuarantee,
  type BgDocument,
  type BgTender,
  type BgType,
  deleteBankGuarantee,
  deleteBankGuaranteeDocument,
  deleteBgTender,
  getBankGuaranteeDocument,
  getBgTender,
  uploadBankGuaranteeDocument,
} from '@/app/lib/api/bank-guarantees';
import { errorMessage } from '@/app/lib/api/client';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { openStoredFile } from '@/app/lib/download-file';
import { formatBytes } from '@/app/lib/files';
import { dateLabel, dateTimeLabel } from '@/app/lib/format';
import { Button, RowAction } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import FileUpload from '@/app/ui/file-upload';
import PageHeader from '@/app/ui/page-header';
import BankGuaranteeActionModal, {
  type BgAction,
} from '@/app/ui/projects/bank-guarantee-action-modal';
import BankGuaranteeModal from '@/app/ui/projects/bank-guarantee-modal';
import {
  BG_EVENT_LABELS,
  BgStatusBadge,
  bgMoney,
} from '@/app/ui/projects/bank-guarantee-parts';
import BgTenderModal from '@/app/ui/projects/bg-tender-modal';
import { DetailCard, Fact } from '@/app/ui/projects/detail-card';
import { TextField } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';
import { useToast } from '@/app/ui/toast';
import { useCanWrite } from '@/app/lib/write-access';

const tenderKey = (id: string) => ['projects', 'bank-guarantees', 'tender', id];

/**
 * One tender and its guarantees (037): each guarantee's figures, its status changes, its
 * documents and its history.
 */
export default function BankGuaranteeTenderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canWrite = useCanWrite();
  const [editingTender, setEditingTender] = useState(false);
  const [guaranteeForm, setGuaranteeForm] = useState<
    { guarantee: BankGuarantee | null; type: BgType } | null
  >(null);
  const [action, setAction] = useState<{ action: BgAction; guarantee: BankGuarantee } | null>(
    null,
  );

  const tender = useQuery({ queryKey: tenderKey(id), queryFn: () => getBgTender(id) });

  const removeTender = useMutation({
    mutationFn: () => deleteBgTender(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', 'bank-guarantees', 'list'] });
      toast.success('Tender deleted.');
      router.push(ROUTES.projectsBankGuarantees);
    },
    onError: (error) => toast.error(errorMessage(error, MESSAGES.saveFailed)),
  });

  if (tender.isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (tender.isError || !tender.data) {
    return (
      <main>
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {MESSAGES.loadFailed}
        </p>
        <p className="mt-3 text-sm">
          <Link href={ROUTES.projectsBankGuarantees} className="text-brand-700 underline">
            Back to bank guarantees
          </Link>
        </p>
      </main>
    );
  }

  const row = tender.data;
  const byType = (type: BgType) => row.guarantees.filter((g) => g.type === type);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={`Sr. No ${row.serialNo} · ${row.departmentName}`}
        breadcrumbs={[{ label: 'Bank Guarantees', href: ROUTES.projectsBankGuarantees }]}
        actions={
          canWrite ? (
            <div className="flex flex-wrap gap-2">
              <RowAction onClick={() => setEditingTender(true)}>Edit tender</RowAction>
              <RowAction
                disabled={row.guarantees.length > 0 || removeTender.isPending}
                title={
                  row.guarantees.length > 0
                    ? 'Delete its guarantees first.'
                    : undefined
                }
                onClick={async () => {
                  if (
                    await confirmDialog({
                      title: 'Delete this tender?',
                      message: 'The tender will be deleted. This cannot be undone.',
                      confirmLabel: 'Delete tender',
                      tone: 'danger',
                    })
                  )
                    removeTender.mutate();
                }}
              >
                Delete tender
              </RowAction>
            </div>
          ) : undefined
        }
      />

      <DetailCard heading="Tender">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Fact term="Work name">
              <span className="whitespace-pre-line">{row.workName}</span>
            </Fact>
          </div>
          <Fact term="Department">{row.departmentName}</Fact>
          <Fact term="Tender amount">{bgMoney(row.tenderAmount)}</Fact>
          <Fact term="Project">
            {row.projectId && row.projectName ? (
              <Link
                href={ROUTES.projectsProject(row.projectId)}
                className="text-brand-700 underline"
              >
                {row.projectName}
              </Link>
            ) : (
              'Not linked'
            )}
          </Fact>
          {row.remarks && <Fact term="Remarks">{row.remarks}</Fact>}
        </dl>
      </DetailCard>

      {(['EMD', 'PBG'] as const).map((type) => (
        <section key={type} className="flex flex-col gap-3" aria-labelledby={`bg-${type}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`bg-${type}`} className="text-base font-semibold text-gray-900">
              {type === 'EMD' ? 'EMD guarantees' : 'Performance guarantees (PBG)'}
            </h2>
            <Button onClick={() => setGuaranteeForm({ guarantee: null, type })}>
              Add {type}
            </Button>
          </div>
          {byType(type).length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-600">
              No {type} guarantee recorded for this tender.
            </p>
          ) : (
            byType(type).map((bg) => (
              <GuaranteeCard
                key={bg.id}
                bg={bg}
                tender={row}
                onEdit={() => setGuaranteeForm({ guarantee: bg, type })}
                onAction={(next) => setAction({ action: next, guarantee: bg })}
              />
            ))
          )}
        </section>
      ))}

      {editingTender && (
        <BgTenderModal
          tender={row}
          onClose={() => setEditingTender(false)}
          onSaved={(saved) => queryClient.setQueryData(tenderKey(id), saved)}
        />
      )}
      {guaranteeForm && (
        <BankGuaranteeModal
          tenderId={id}
          guarantee={guaranteeForm.guarantee}
          defaultType={guaranteeForm.type}
          onClose={() => setGuaranteeForm(null)}
        />
      )}
      {action && (
        <BankGuaranteeActionModal
          action={action.action}
          guarantee={action.guarantee}
          onClose={() => setAction(null)}
        />
      )}
    </main>
  );
}

function GuaranteeCard({
  bg,
  tender,
  onEdit,
  onAction,
}: {
  bg: BankGuarantee;
  tender: BgTender;
  onEdit: () => void;
  onAction: (action: BgAction) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const running = bg.status === 'RUNNING';
  const [title, setTitle] = useState('BG copy');

  const apply = (saved: BgTender) => {
    queryClient.setQueryData(tenderKey(tender.id), saved);
    void queryClient.invalidateQueries({ queryKey: ['projects', 'bank-guarantees', 'list'] });
  };

  const remove = useMutation({
    mutationFn: () => deleteBankGuarantee(bg.id),
    onSuccess: (saved) => {
      apply(saved);
      toast.success('Guarantee deleted.');
    },
    onError: (error) => toast.error(errorMessage(error, MESSAGES.saveFailed)),
  });

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {bg.type} · <span className="break-all">{bg.bgNumber ?? 'Number not yet issued'}</span>
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">
            {bgMoney(bg.amount)}
          </p>
        </div>
        <BgStatusBadge status={bg.displayStatus} daysToExpiry={bg.daysToExpiry} />
      </header>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Fact term="Issue date">{dateLabel(bg.issueDate)}</Fact>
        <Fact term="Expiry date">{dateLabel(bg.expiryDate)}</Fact>
        {bg.claimPeriodEndDate && (
          <Fact term="Claim period ends">{dateLabel(bg.claimPeriodEndDate)}</Fact>
        )}
        {(bg.issuingBank || bg.issuingBranch) && (
          <Fact term="Issuing bank">
            {[bg.issuingBank, bg.issuingBranch].filter(Boolean).join(', ')}
          </Fact>
        )}
        {(bg.marginAmount || bg.fdReference) && (
          <Fact term="Margin money / FD">
            {[bg.marginAmount ? bgMoney(bg.marginAmount) : null, bg.fdReference]
              .filter(Boolean)
              .join(' · ')}
          </Fact>
        )}
        {bg.releasedOn && <Fact term="Released on">{dateLabel(bg.releasedOn)}</Fact>}
        {bg.encashedOn && (
          <Fact term="Encashed">
            {bgMoney(bg.encashedAmount)} on {dateLabel(bg.encashedOn)}
          </Fact>
        )}
        {bg.remarks && <Fact term="Remarks">{bg.remarks}</Fact>}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {running ? (
          <>
            <RowAction onClick={onEdit}>Edit</RowAction>
            <RowAction onClick={() => onAction('extend')}>Extend</RowAction>
            <RowAction onClick={() => onAction('release')}>Mark released</RowAction>
            <RowAction onClick={() => onAction('encash')}>Mark encashed</RowAction>
          </>
        ) : (
          <RowAction onClick={() => onAction('reopen')}>Reopen</RowAction>
        )}
        <RowAction
          disabled={remove.isPending}
          onClick={async () => {
            if (
              await confirmDialog({
                title: 'Delete this guarantee?',
                message:
                  'Only for a guarantee entered by mistake. Its documents and history are deleted with it. This cannot be undone.',
                confirmLabel: 'Delete guarantee',
                tone: 'danger',
                typeToConfirm: 'DELETE',
              })
            )
              remove.mutate();
          }}
        >
          Delete
        </RowAction>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-label="Documents">
          <h3 className="text-sm font-medium text-gray-900">
            Documents ({bg.documents.length})
          </h3>
          {bg.documents.length === 0 ? (
            <p className="mt-1 text-sm text-gray-600">No documents attached.</p>
          ) : (
            <ul className="mt-1 divide-y divide-gray-100">
              {bg.documents.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} onChanged={apply} />
              ))}
            </ul>
          )}
          <UploadDocument
            title={title}
            onTitle={setTitle}
            guaranteeId={bg.id}
            onUploaded={(saved) => {
              apply(saved);
              setTitle('BG copy');
              toast.success('Document attached.');
            }}
          />
        </section>

        <section aria-label="History">
          <h3 className="text-sm font-medium text-gray-900">History</h3>
          <ol className="mt-1 space-y-1.5 text-sm">
            {bg.events.map((event) => (
              <li key={event.id} className="text-gray-700">
                <span className="font-medium text-gray-900">
                  {BG_EVENT_LABELS[event.kind] ?? event.kind}
                </span>
                {event.kind === 'extended' && (
                  <>
                    {' '}
                    from {dateLabel(event.fromDate)} to {dateLabel(event.toDate)}
                  </>
                )}
                {event.kind === 'edited' && event.toDate && (
                  <>
                    {' '}
                    — expiry {dateLabel(event.fromDate)} → {dateLabel(event.toDate)}
                  </>
                )}
                {event.note && <> — {event.note}</>}
                <span className="block text-xs text-gray-500">
                  {event.actorName ?? 'Unknown user'} · {dateTimeLabel(event.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}

function DocumentRow({
  doc,
  onChanged,
}: {
  doc: BgDocument;
  onChanged: (tender: BgTender) => void;
}) {
  const toast = useToast();
  const open = useMutation({
    mutationFn: () => getBankGuaranteeDocument(doc.id),
    onSuccess: (file) => openStoredFile(file, doc.fileName ?? doc.title),
    onError: (error) => toast.error(errorMessage(error, 'Could not open the document.')),
  });
  const remove = useMutation({
    mutationFn: () => deleteBankGuaranteeDocument(doc.id),
    onSuccess: (saved) => {
      onChanged(saved);
      toast.success('Document removed.');
    },
    onError: (error) => toast.error(errorMessage(error, MESSAGES.saveFailed)),
  });
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{doc.title}</p>
        <p className="truncate text-xs text-gray-500">
          {[doc.fileName, formatBytes(doc.sizeBytes), doc.uploadedByName, dateLabel(doc.uploadedAt)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex gap-1">
        <RowAction intent="read" onClick={() => open.mutate()} disabled={open.isPending}>
          Open
        </RowAction>
        <RowAction
          disabled={remove.isPending}
          onClick={async () => {
            if (
              await confirmDialog({
                title: 'Remove this document?',
                message: `${doc.title} will be removed from this guarantee.`,
                confirmLabel: 'Remove',
                tone: 'danger',
              })
            )
              remove.mutate();
          }}
        >
          Remove
        </RowAction>
      </div>
    </li>
  );
}

/** A title and a file; the upload starts when the file is chosen. Hidden from read-only users. */
function UploadDocument({
  guaranteeId,
  title,
  onTitle,
  onUploaded,
}: {
  guaranteeId: string;
  title: string;
  onTitle: (value: string) => void;
  onUploaded: (tender: BgTender) => void;
}) {
  const canWrite = useCanWrite();
  const [open, setOpen] = useState(false);
  if (!canWrite) return null;
  // Behind a button: an always-open name-and-file panel on every guarantee made the page
  // mostly upload boxes.
  if (!open) {
    return (
      <div className="mt-2">
        <RowAction onClick={() => setOpen(true)}>Attach document</RowAction>
      </div>
    );
  }
  return (
    <div className="mt-3 grid gap-2 rounded-md bg-gray-50 p-3">
      <TextField
        id={`bg-doc-title-${guaranteeId}`}
        label="Document name"
        placeholder="e.g. BG copy, Extension letter"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
      />
      <FileUpload
        id={`bg-doc-file-${guaranteeId}`}
        label="Attach a file"
        hint="PDF or photo, up to 10 MB. Photos are compressed."
        disabled={!title.trim()}
        onUpload={(file) =>
          uploadBankGuaranteeDocument(guaranteeId, {
            title: title.trim(),
            data: file.base64,
            contentType: file.mimeType,
            fileName: file.fileName,
          })
        }
        onUploaded={(result) => {
          onUploaded(result as BgTender);
          setOpen(false);
        }}
      />
      <div>
        <RowAction intent="read" onClick={() => setOpen(false)}>
          Cancel
        </RowAction>
      </div>
    </div>
  );
}
