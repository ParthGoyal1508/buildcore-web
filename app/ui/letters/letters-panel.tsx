'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import type * as React from 'react';
import { useState } from 'react';

import { decideApproval } from '@/app/lib/api/approvals';
import { errorMessage } from '@/app/lib/api/client';
import {
  type IssuedLetter,
  type LetterKind,
  type LetterQuery,
  composeLetter,
  downloadLetter,
  getLetterKinds,
  getLetterPrefill,
  getLetters,
  getSignatories,
  issueLetter,
  previewComposedLetter,
  previewLetter,
} from '@/app/lib/api/letters';
import { GENERATE_LETTER_COPY, LETTER_COPY } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import ActionReview from '@/app/ui/approvals/action-review';
import { confirmDialog } from '@/app/ui/dialogs';
import LineItemsEditor, {
  type LineItemsSource,
} from '@/app/ui/letters/line-items-editor';
import { PdfPreview, useFileViewer } from '@/app/ui/pdf-viewer';
import QueryError from '@/app/ui/query-error';
import { ListSkeleton } from '@/app/ui/skeletons';
import StatusBadge from '@/app/ui/status-badge';
import {
  SortHeader,
  TABLE,
  useSortedRows,
  type SortableColumn,
} from '@/app/ui/table';
import { useToast } from '@/app/ui/toast';

// The inline draft preview now lives with the shared viewer (2026-10-14); re-exported so a screen
// that took it from here keeps working.
export { PdfPreview };

// The sortable columns of the letters list (2026-10-15); the document column has nothing to order.
const LETTER_COLUMNS: (SortableColumn<IssuedLetter> & { label: string })[] = [
  { key: 'letterKindLabel', label: 'Kind', render: (l) => l.letterKindLabel },
  { key: 'status', label: 'State', render: (l) => l.status },
  {
    key: 'issuedAt',
    label: 'Issued',
    render: () => null,
    sortValue: (l) => l.issuedAt,
  },
];

/**
 * The commercial letters — LOI, work order, purchase order — composed, approved, issued and
 * downloaded in one place, whatever they are addressed to (2026-10-15).
 *
 * This was the project Letters tab and nothing else. Two more places now issue the same letters:
 * a work order's own record, which issues its LOI and its work order from the rates it holds, and
 * Inventory's purchase orders, which address a vendor and belong to no project. Three copies of a
 * composer is three places for "a signatory must be named" to be forgotten, so the list and the
 * composer live here and each screen says only what differs — the subject, the kinds offered, what
 * the form opens filled with, and where the item rows are picked from.
 *
 * ## The subject pair is opaque, deliberately
 *
 * A letter addresses `subjectType` + `subjectId` and the letters module never resolves the pair.
 * That is what lets a letter address a project or a vendor without that module knowing what either
 * is — so a screen passes `project` or `vendor` and the id, and asks for nothing else.
 *
 * ## The fields come from the kind, not from here
 *
 * Each kind declares its own tokens, and a field that renders blank in a signed letter is
 * indistinguishable from a deliberate omission. So the form is built from what the kind declares
 * — read through the prefill, which carries each declaration with its record value and needs only
 * the kind's own permission (the declarations endpoint needs Settings, which a buyer does not hold)
 * — rather than from a list typed here, and a kind whose fields change needs no change to this file.
 */

/**
 * The order the typed fields read in on the letter (2026-10-14). The API lists a kind's fields by
 * token, which put "Completion by" first and "Issued to" last — the reverse of how anybody fills in
 * a work order. A token not listed here keeps the API's order, after these. One list serves the
 * LOI, work order and purchase order: each shows the ones it declares, in this order.
 */
const FIELD_ORDER = [
  'vendorName',
  'vendorAddress',
  'vendorCode',
  'vendorAttention',
  'vendorMobile',
  'vendorEmail',
  'vendorPan',
  'vendorGstin',
  'subcontractorAttention',
  'vendorPfNo',
  'vendorEsicNo',
  'loiReference',
  'revisedDate',
  'buyerName',
  'buyerMobile',
  'buyerEmail',
  'scope',
  'proposalDate',
  'scopeDetail',
  'scopeBrief',
  'workLocation',
  'deliveryAddress',
  'lineItems',
  'gstRate',
  'gstInclusion',
  'startDate',
  'commencementDate',
  'completionDate',
  'completionPeriod',
  'billingInterval',
  'materialResponsibility',
  'paymentTerms',
  'deliveryTerms',
  'retention',
  'defectsLiability',
  'liquidatedDamages',
  'performanceGuarantee',
  'escalation',
  'subcontractorScope',
  'companyScope',
  'confidentialityPeriod',
  'poProject',
  'documentsAndTools',
  'training',
  'siteSupport',
  'inventorySupport',
  'warrantyFromDispatch',
  'warrantyFromCommissioning',
  'companyAddress',
  'companyGstin',
  'companyEmail',
];

/** Free text that runs to several lines — an address, a scope, the item lines. */
const MULTI_LINE = new Set([
  'vendorAddress',
  'deliveryAddress',
  'scopeDetail',
  'subcontractorScope',
  'companyScope',
  'paymentTerms',
  // 036 J3 (2026-10-17): an address and the delivery terms run to several lines on the client's
  // own orders, and a single-line box hid all but the first few words of what was being signed.
  'companyAddress',
  'deliveryTerms',
]);

/**
 * 036 J3 (2026-10-17): what is said before a letter is issued. Issuing gives it its permanent
 * reference number — the next in the company's sequence, never reused — and the issued letter
 * cannot be edited; a correction is a reissue, which supersedes it and keeps both. That used to
 * happen on one click with no word of warning, from a button beside Preview.
 */
function confirmIssue(label: string) {
  return confirmDialog({
    title: `Issue this ${label.toLowerCase()}?`,
    message:
      'Issuing gives it a permanent reference number, and it cannot be edited afterwards — a correction means reissuing it as a new version. Preview it first if you have not.',
    confirmLabel: 'Issue',
    tone: 'default',
  });
}

/**
 * Fields read from a record that are still offered for editing (2026-10-14): the company's own
 * address, GSTN and email as Settings holds them, which a particular order may need to differ —
 * and which, where Settings has none, must be typed for the order to issue.
 */
const EDITABLE_FROM_RECORD = new Set([
  'companyAddress',
  'companyGstin',
  'companyEmail',
]);

/**
 * What the client's formats say in these places unless an order says otherwise (2026-10-14),
 * filled in so the person issuing changes only what differs. Sent with the letter, not merely
 * shown: a value displayed but not sent would print blank.
 */
const FIELD_DEFAULTS: Record<string, string> = {
  gstRate: '18',
  gstInclusion: 'exclusive',
  billingInterval: 'monthly intervals',
  materialResponsibility: 'As agreed',
  retention: 'Not Applicable',
  defectsLiability: 'Not Applicable',
  liquidatedDamages: 'Not Applicable',
  performanceGuarantee: 'Not Applicable',
  escalation: 'Not applicable',
  confidentialityPeriod: '3 years',
};

/** The active kinds among `keys`, in the order given. */
export function useLetterKinds(keys: readonly string[]) {
  const kinds = useQuery({
    queryKey: ['letter-kinds'],
    queryFn: () => getLetterKinds(),
  });
  const offered = keys
    .map((key) => (kinds.data ?? []).find((kind) => kind.key === key))
    .filter((kind): kind is LetterKind => Boolean(kind?.isActive));
  return { ...kinds, offered };
}

/**
 * One subject's letters with the composer above them — the project Letters tab.
 *
 * Every letter on the subject is listed, whatever its kind: a kind no longer offered here (a
 * purchase order raised on a project before purchase orders moved to Inventory) is still a letter
 * that went out, and hiding it would make it unfindable from the place it was issued.
 */
export default function SubjectLettersPanel({
  subjectType,
  subjectId,
  kinds,
  itemsSource,
  projectId,
  initialValues,
  heading,
  description,
  emptyMessage,
}: {
  subjectType: string;
  subjectId: string;
  /** The kinds offered to compose. Letters of other kinds already on the subject still list. */
  kinds: readonly string[];
  itemsSource: LineItemsSource;
  projectId?: string;
  initialValues?: Record<string, string>;
  heading: string;
  description: string;
  emptyMessage: string;
}) {
  const [composing, setComposing] = useState<LetterKind | null>(null);
  const offered = useLetterKinds(kinds);
  const query: LetterQuery = { subjectType, subjectId };
  const letters = useQuery({
    queryKey: ['letters', subjectType, subjectId],
    queryFn: () => getLetters(query),
  });

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">{heading}</h2>
        <p className="text-sm text-gray-600">{description}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {offered.isSuccess && offered.offered.length === 0 ? (
          <p className="text-sm text-gray-600">
            No letter kind is defined for this. They are configured in settings
            rather than released.
          </p>
        ) : (
          offered.isError ? (
            // 036 J1 (2026-10-17): a failed read of the kinds offered nothing and said nothing.
            <QueryError
              compact
              error={offered.error}
              fallback="The letter kinds could not be loaded."
              onRetry={offered.refetch}
            />
          ) : offered.offered.map((kind) => (
            <Button key={kind.id} onClick={() => setComposing(kind)}>
              Issue a {kind.label.toLowerCase()}
            </Button>
          ))
        )}
      </div>

      {composing && (
        <LetterComposer
          key={composing.id}
          kind={composing}
          subjectType={subjectType}
          subjectId={subjectId}
          itemsSource={itemsSource}
          projectId={projectId}
          initialValues={initialValues}
          onClose={() => setComposing(null)}
          onIssued={() => setComposing(null)}
        />
      )}

      <LetterTable
        letters={letters.data ?? []}
        isLoading={letters.isLoading}
        error={letters.error}
        onRetry={letters.refetch}
        emptyMessage={emptyMessage}
      />
    </section>
  );
}

/** Every cached letters list, so a letter composed on one screen shows on the others. */
function useRefreshLetters() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['letters'] });
}

/**
 * Letters as a table: each one's state, its approval inline for whoever's turn it is, and what can
 * be done with it — a draft previewed or issued, an issued one downloaded.
 */
export function LetterTable({
  letters,
  isLoading,
  error,
  onRetry,
  emptyMessage,
  extraActions,
  statusExtra,
}: {
  letters: IssuedLetter[];
  isLoading: boolean;
  /**
   * 036 J1 (2026-10-17): the list query's error. A failed fetch used to fall through to the empty
   * message — "No letter has been issued on this project" — which is a claim, and a wrong one.
   */
  error?: unknown;
  onRetry?: () => unknown;
  emptyMessage: string;
  /** More actions for an issued letter's row — a purchase order's NOC (2026-10-15). */
  extraActions?: (letter: IssuedLetter) => React.ReactNode;
  /** Shown under an issued letter's status — a purchase order's NOC open/closed (2026-10-17). */
  statusExtra?: (letter: IssuedLetter) => React.ReactNode;
}) {
  const refresh = useRefreshLetters();
  const toast = useToast();
  /** The letter whose Preview or Issue is in flight, for its button's spinner. */
  const [pending, setPending] = useState<{
    id: string;
    action: 'preview' | 'issue';
  } | null>(null);
  /** An issued letter read in the page, without saving it (2026-10-14). */
  const { view, viewer } = useFileViewer();
  /** A composed letter's draft, open for reading before it is approved or issued. */
  const [previewing, setPreviewing] = useState<{
    title: string;
    blob: Blob;
  } | null>(null);

  const download = async (letter: IssuedLetter) => {
    try {
      const blob = await downloadLetter(letter.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${letter.referenceNo ?? letter.letterKindLabel}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, 'That letter could not be downloaded.'));
    }
  };

  const preview = async (letter: IssuedLetter) => {
    setPending({ id: letter.id, action: 'preview' });
    try {
      setPreviewing({
        title: `${letter.letterKindLabel} — draft`,
        blob: await previewComposedLetter(letter.id),
      });
    } catch (err) {
      toast.error(errorMessage(err, 'That letter could not be previewed.'));
    } finally {
      setPending(null);
    }
  };

  const issue = async (letter: IssuedLetter) => {
    if (!(await confirmIssue(letter.letterKindLabel))) return;
    setPending({ id: letter.id, action: 'issue' });
    try {
      const issued = await issueLetter(letter.id, {});
      toast.success(
        issued.referenceNo
          ? `Issued as ${issued.referenceNo}.`
          : `${letter.letterKindLabel} issued.`,
      );
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, 'That letter could not be issued.'));
    } finally {
      setPending(null);
    }
  };

  // Before the loading return, so the hook runs on every render.
  const { sorted, sort, toggle } = useSortedRows(letters, LETTER_COLUMNS);

  if (isLoading) {
    return (
      <ListSkeleton
        headers={[...LETTER_COLUMNS.map((c) => c.label), 'Document']}
        rows={3}
      />
    );
  }
  if (error) {
    return (
      <QueryError
        error={error}
        fallback="The letters could not be loaded."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {viewer}
      {previewing && (
        <PdfPreview
          title={previewing.title}
          blob={previewing.blob}
          onClose={() => setPreviewing(null)}
        />
      )}
      {letters.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          {emptyMessage}
        </p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                {LETTER_COLUMNS.map((column) => (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    columnKey={column.key}
                    sort={sort}
                    onSort={toggle}
                  />
                ))}
                <th className={clsx(TABLE.th, 'text-right')}>Document</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((letter) => {
                // A composed letter has no document yet (2026-10-14). While its chain is running it
                // is decided here, by whoever's turn it is; once approved — or where nothing gates
                // it — it is issued here. Download is offered only for what has been issued.
                const approval = letter.approval;
                const awaiting =
                  letter.status === 'composed' &&
                  approval !== null &&
                  approval.state !== 'approved';
                // Who it went to, as typed on it (2026-10-15): a purchase-order list spans every
                // vendor, and a project's letters span its subcontractors.
                const addressee = letter.composedVariables.vendorName;
                return (
                  <tr key={letter.id} className={clsx(TABLE.row, 'align-top')}>
                    <td className={clsx(TABLE.td, 'align-top')}>
                      {letter.letterKindLabel}
                      {letter.referenceNo && (
                        <span className="block text-xs text-gray-500">
                          {letter.referenceNo}
                        </span>
                      )}
                      {addressee && (
                        <span className="block text-xs text-gray-700">
                          {addressee}
                        </span>
                      )}
                    </td>
                    <td className={clsx(TABLE.td, 'align-top')}>
                      <StatusBadge status={letter.status} />
                      {statusExtra && letter.status !== 'composed' && (
                        <div className="mt-1">{statusExtra(letter)}</div>
                      )}
                      {awaiting && approval && (
                        <div className="mt-2 max-w-md">
                          <ActionReview
                            state={approval}
                            entityLabel={letter.letterKindLabel.toLowerCase()}
                            size="full"
                            onDecide={async (action, reason) => {
                              await decideApproval(approval.instanceId, {
                                action,
                                reason,
                              });
                              refresh();
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className={clsx(TABLE.td, 'align-top')}>
                      {letter.issuedAt
                        ? dateLabel(String(letter.issuedAt))
                        : '—'}
                    </td>
                    <td className={clsx(TABLE.td, 'align-top text-right')}>
                      {letter.status === 'composed' ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            intent="write"
                            loading={
                              pending?.id === letter.id &&
                              pending.action === 'preview'
                            }
                            disabled={pending !== null}
                            onClick={() => void preview(letter)}
                          >
                            Preview
                          </Button>
                          {awaiting ? (
                            <span className="text-xs text-gray-500">
                              Issued once approved
                            </span>
                          ) : (
                            <Button
                              loading={
                                pending?.id === letter.id &&
                                pending.action === 'issue'
                              }
                              disabled={pending !== null}
                              onClick={() => void issue(letter)}
                            >
                              Issue
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            intent="read"
                            onClick={() =>
                              void view({
                                title:
                                  letter.referenceNo ?? letter.letterKindLabel,
                                fileName: `${letter.referenceNo ?? letter.letterKindLabel}.pdf`,
                                load: () => downloadLetter(letter.id),
                              })
                            }
                          >
                            View
                          </Button>
                          <Button intent="read" onClick={() => void download(letter)}>
                            Download
                          </Button>
                          {extraActions?.(letter)}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * One letter being composed.
 *
 * **A gated kind comes back `composed` rather than `issued`, and that is not an error.** The letter
 * is waiting on a person; rendering it as a failure would send somebody to raise it again.
 *
 * `initialValues` open the form filled from the record it is issued from — a work order's rates
 * and subcontractor, a vendor's address (2026-10-15). They are sent with the letter as a typed value
 * is, so what the form showed is what prints; a token among them that the kind does not declare is
 * sent too, unshown — that is how a work order's record finds its own letters again.
 */
export function LetterComposer({
  kind,
  subjectType,
  subjectId,
  itemsSource,
  projectId,
  initialValues = {},
  title,
  onClose,
  onIssued,
  onComposed,
}: {
  kind: LetterKind;
  subjectType: string;
  subjectId: string;
  itemsSource: LineItemsSource;
  projectId?: string;
  initialValues?: Record<string, string>;
  /** Shown instead of the kind's label — "Letter of intent — WO-0007". */
  title?: string;
  onClose: () => void;
  onIssued: () => void;
  /** A gated letter was composed: it is in the list now, waiting on its approval. */
  onComposed?: () => void;
}) {
  const refresh = useRefreshLetters();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [signatoryId, setSignatoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Blob | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // What the records say for each field — the terms, from Settings — so an editable one opens
  // filled in rather than empty. It also carries the kind's declarations, which is what the form
  // is built from.
  const prefill = useQuery({
    queryKey: ['letter-prefill', kind.key, subjectType, subjectId],
    queryFn: () =>
      getLetterPrefill({ letterKindKey: kind.key, subjectType, subjectId }),
  });
  const recordValue = (token: string) =>
    prefill.data?.fields.find((f) => f.token === token)?.value ?? '';

  const rank = (token: string) => {
    const at = FIELD_ORDER.indexOf(token);
    return at === -1 ? FIELD_ORDER.length : at;
  };
  // Only the manual ones: everything else the server reads from its own source, and offering a box
  // for a value the server will overwrite teaches people their typing does not matter.
  const manual = (prefill.data?.fields ?? [])
    .filter(
      (field) =>
        field.sourceType === 'manual' || EDITABLE_FROM_RECORD.has(field.token),
    )
    .sort((a, b) => rank(a.token) - rank(b.token));
  const valueOf = (token: string) =>
    values[token] ??
    initialValues[token] ??
    (EDITABLE_FROM_RECORD.has(token)
      ? recordValue(token)
      : (FIELD_DEFAULTS[token] ?? ''));
  // The defaults this kind declares, sent beneath whatever was typed over them.
  const defaults = Object.fromEntries(
    manual
      .filter((field) => field.token in FIELD_DEFAULTS)
      .map((field) => [field.token, FIELD_DEFAULTS[field.token]]),
  );
  const prefilled = Object.fromEntries(
    Object.entries(initialValues).filter(([, value]) => value.trim() !== ''),
  );

  // A work order, LOI or purchase order is signed (2026-10-14). This composer never asked who signs,
  // so every one of them was refused by the server with "a signatory must be named" — whether or not
  // the company had a signatory set up.
  const signatories = useQuery({
    queryKey: ['signatories'],
    queryFn: () => getSignatories(),
    enabled: kind.requiresSignature,
  });
  const active = (signatories.data ?? []).filter((s) => s.isActive);
  const chosenSignatory = signatoryId || active[0]?.id || '';
  const noSignatory =
    kind.requiresSignature && signatories.isSuccess && active.length === 0;

  const input = () => ({
    letterKindKey: kind.key,
    subjectType,
    subjectId,
    // Only what was edited or filled from the record is sent. An untouched record field is read at
    // issue, so a letter waiting on approval picks up a change made in Settings in the meantime.
    variables: { ...defaults, ...prefilled, ...values },
    ...(kind.requiresSignature && chosenSignatory
      ? { signatoryId: chosenSignatory }
      : {}),
  });

  // The letter as it would be issued, before anything is written — marked DRAFT, with no
  // reference and no signature graphic. A blank required field prints as its label in brackets.
  const showPreview = async () => {
    setPreviewBusy(true);
    setError(null);
    try {
      setDraft(await previewLetter(input()));
    } catch (err) {
      setError(errorMessage(err, 'The preview could not be produced.'));
    } finally {
      setPreviewBusy(false);
    }
  };

  const compose = useMutation({
    mutationFn: () => composeLetter(input()),
    onSuccess: (letter) => {
      setError(null);
      refresh();
      if (letter.status === 'issued') {
        toast.success(
          letter.referenceNo
            ? `Issued as ${letter.referenceNo}.`
            : `${kind.label} issued.`,
        );
        onIssued();
      } else {
        setNotice(
          'Composed, and waiting on an approval. It is not issued yet, and raising it again would make a second one.',
        );
        onComposed?.();
      }
    },
    // What was typed stays in the form: a refusal is fixed and resent, never retyped.
    onError: (err: Error) =>
      setError(errorMessage(err, 'The letter could not be issued.')),
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-gray-200 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        // An ungated kind is issued by this very call, so it asks first (036 J3). A gated one only
        // goes for approval here; the reference is given when it is issued, which asks then.
        if (!kind.requiresApproval && !(await confirmIssue(kind.label))) return;
        compose.mutate();
      }}
    >
      <h3 className="text-sm font-semibold text-gray-900">
        {title ?? kind.label}
      </h3>

      {prefill.isLoading ? (
        <p className="text-sm text-gray-500">
          Reading the kind&rsquo;s fields…
        </p>
      ) : prefill.isError ? (
        <QueryError
          error={prefill.error}
          fallback="This letter’s fields could not be read."
          onRetry={prefill.refetch}
        />
      ) : manual.length === 0 ? (
        <p className="text-sm text-gray-600">
          This kind fills itself from its records and needs nothing typed.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {manual.map((field) => {
            const multiLine = MULTI_LINE.has(field.token);
            if (field.token === 'lineItems') {
              // Picked from the BOQ or the item master and priced row by row (2026-10-14), rather
              // than typed as pipe-separated lines. A div, not a label: it holds a whole table.
              return (
                <div
                  key={field.token}
                  className="flex flex-col gap-1 text-sm sm:col-span-2"
                >
                  <span className="font-medium text-gray-700">
                    {field.label}
                    {field.isRequired && (
                      <span className="text-red-600"> *</span>
                    )}
                  </span>
                  <LineItemsEditor
                    projectId={projectId}
                    value={valueOf(field.token)}
                    onChange={(next) =>
                      setValues((current) => ({
                        ...current,
                        [field.token]: next,
                      }))
                    }
                    withHsn={kind.key === 'letter_work_order'}
                    source={itemsSource}
                  />
                </div>
              );
            }
            const common = {
              required: field.isRequired,
              value: valueOf(field.token),
              onChange: (
                event: React.ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement
                >,
              ) =>
                setValues((current) => ({
                  ...current,
                  [field.token]: event.target.value,
                })),
              className: 'rounded-md border border-gray-300 px-3 py-2',
            };
            return (
              <label
                key={field.token}
                className={`flex flex-col gap-1 text-sm${
                  multiLine ? ' sm:col-span-2' : ''
                }`}
              >
                <span className="font-medium text-gray-700">
                  {field.label}
                  {field.isRequired && <span className="text-red-600"> *</span>}
                </span>
                {multiLine ? (
                  <textarea rows={3} {...common} />
                ) : (
                  <input {...common} />
                )}
              </label>
            );
          })}
        </div>
      )}

      {kind.requiresSignature &&
        (noSignatory ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            {GENERATE_LETTER_COPY.noSignatories}
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
            <span className="font-medium text-gray-700">Signatory</span>
            <select
              required
              value={chosenSignatory}
              onChange={(event) => setSignatoryId(event.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {LETTER_COPY.signatoryRequired}
            </span>
          </label>
        ))}

      {error && (
        <p
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          className="rounded-md bg-brand-50 p-3 text-sm text-brand-900"
          role="status"
        >
          {notice}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          intent="write"
          loading={previewBusy}
          disabled={noSignatory || !prefill.isSuccess}
          onClick={() => void showPreview()}
        >
          {previewBusy ? 'Preparing…' : draft ? 'Refresh preview' : 'Preview'}
        </Button>
        <Button
          type="submit"
          loading={compose.isPending}
          disabled={noSignatory || !prefill.isSuccess || !!notice}
        >
          {kind.requiresApproval
            ? compose.isPending
              ? 'Submitting…'
              : 'Submit for approval'
            : compose.isPending
              ? 'Issuing…'
              : 'Issue'}
        </Button>
        <Button type="button" intent="write" onClick={onClose}>
          {notice ? 'Close' : 'Cancel'}
        </Button>
      </div>

      {draft && (
        <PdfPreview
          title={`${title ?? kind.label} — draft`}
          blob={draft}
          onClose={() => setDraft(null)}
        />
      )}
    </form>
  );
}
