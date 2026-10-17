'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getCurrentDisposal,
  getDisposalAttachment,
  getEquipmentHistory,
  reverseDisposal,
  type EquipmentDisposal,
} from '@/app/lib/api/plant';
import { getCurrentUser } from '@/app/lib/api/users';
import {
  DISPOSAL_PAYMENT_MODE_LABELS,
  DISPOSED_EQUIPMENT_STATUSES,
  SCRAP_REASON_LABELS,
} from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import { promptDialog } from '@/app/ui/dialogs';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import DisposeModal from '@/app/ui/plant/dispose-modal';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';
import { dateTimeLabel } from '@/app/lib/format';
import { TextButton } from '@/app/ui/button';

/**
 * A machine's disposal on its detail page (2026-10-17): the Dispose action while it is in service,
 * and once scrapped or sold, the record — what was realised, the book value, profit or loss, who
 * approved it, the attachment — with Reverse for a Super Admin who finds it was a mistake.
 */
export function EquipmentDisposalPanel({
  equipment,
}: {
  equipment: { id: string; code: string; name: string; status: string };
}) {
  const queryClient = useQueryClient();
  const [disposing, setDisposing] = useState<'scrapped' | 'sold' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show, viewer } = useFileViewer();
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const canDispose = user.data?.permissions.includes('MACHINERY_DISPOSE') ?? false;
  const disposed = (DISPOSED_EQUIPMENT_STATUSES as readonly string[]).includes(
    equipment.status,
  );

  const record = useQuery({
    queryKey: ['plant', 'equipment', equipment.id, 'disposal'],
    queryFn: () => getCurrentDisposal(equipment.id),
    enabled: disposed,
  });

  const reverse = useMutation({
    mutationFn: (reason: string) => reverseDisposal(equipment.id, reason),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['plant'] }),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not reverse the disposal.'),
  });

  if (!disposed) {
    if (!canDispose) return null;
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Dispose</h2>
          <p className="text-xs text-gray-500">
            Retire this machine from use by marking it scrapped or sold.
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setDisposing('scrapped')}>
            Mark as Scrapped
          </SecondaryButton>
          <SecondaryButton onClick={() => setDisposing('sold')}>Mark as Sold</SecondaryButton>
        </div>
        {disposing && (
          <DisposeModal
            equipment={equipment}
            initialType={disposing}
            onClose={() => setDisposing(null)}
            onDone={() => setDisposing(null)}
          />
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-red-200 bg-red-50/40 p-4">
      {viewer}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">
          {equipment.status === 'sold' ? 'Sold' : 'Scrapped'}
        </h2>
        {canDispose && record.data && (
          <SecondaryButton
            disabled={reverse.isPending}
            onClick={async () => {
              setError(null);
              const reason = await promptDialog({
                title: 'Reverse this disposal?',
                message:
                  'The machine goes back into service with the status it had. It is not put back on its site — deploy it again if needed.',
                label: 'Reason',
                required: true,
                multiline: true,
                confirmLabel: 'Reverse',
              });
              if (reason) reverse.mutate(reason);
            }}
          >
            {reverse.isPending ? 'Reversing…' : 'Reverse disposal'}
          </SecondaryButton>
        )}
      </div>
      <FormError message={error} />
      {record.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : record.data ? (
        <DisposalFacts
          disposal={record.data}
          onOpenAttachment={async () => {
            try {
              show(await getDisposalAttachment(record.data!.id), record.data!.attachmentName ?? 'Attachment');
            } catch {
              setError('Could not open the attachment.');
            }
          }}
        />
      ) : null}
    </section>
  );
}

export function DisposalFacts({
  disposal,
  onOpenAttachment,
}: {
  disposal: EquipmentDisposal;
  onOpenAttachment: () => void;
}) {
  const sale = disposal.type === 'sold';
  const facts: [string, React.ReactNode][] = [
    [sale ? 'Sale date' : 'Scrap date', disposal.disposalDate],
    ...(sale
      ? ([
          ['Buyer', disposal.counterpartyName ?? '—'],
          ['Buyer contact', disposal.buyerContact ?? '—'],
          ['Sale amount', money(disposal.valueRealised)],
          ['Payment mode', disposal.paymentMode ? DISPOSAL_PAYMENT_MODE_LABELS[disposal.paymentMode] ?? disposal.paymentMode : '—'],
          ['Invoice number', disposal.invoiceNumber ?? '—'],
          [
            'Book value',
            <>
              {money(disposal.bookValue)}
              {disposal.bookValueSource && (
                <span className="ml-1 text-xs text-gray-500">
                  ({disposal.bookValueSource === 'depreciation' ? 'from depreciation' : 'entered'})
                </span>
              )}
            </>,
          ],
          [
            'Profit / loss',
            <span
              key="pl"
              className={(disposal.profitLoss ?? 0) < 0 ? 'text-red-700' : 'text-green-700'}
            >
              {money(disposal.profitLoss)}
            </span>,
          ],
        ] as [string, React.ReactNode][])
      : ([
          ['Reason', disposal.scrapReason ? SCRAP_REASON_LABELS[disposal.scrapReason] : '—'],
          ['Scrap value realised', money(disposal.valueRealised)],
          ['Scrap vendor / buyer', disposal.counterpartyName ?? '—'],
        ] as [string, React.ReactNode][])),
    ['Approved by', disposal.approvedBy],
    ['Released from site', disposal.releasedSiteName ?? '—'],
    ['Remarks', disposal.remarks ?? '—'],
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 border-b border-gray-100 pb-1">
          <dt className="text-gray-600">{label}</dt>
          <dd className="text-right text-gray-900">{value}</dd>
        </div>
      ))}
      {disposal.hasAttachment && (
        <div className="sm:col-span-2">
          <TextButton
            className="underline"
            onClick={onOpenAttachment}
          >
            {disposal.attachmentName ?? 'View attachment'}
          </TextButton>
        </div>
      )}
    </dl>
  );
}

/** What has happened to the machine, newest first (2026-10-17). */
export function EquipmentHistoryPanel({ equipmentId }: { equipmentId: string }) {
  const history = useQuery({
    queryKey: ['plant', 'equipment', equipmentId, 'history'],
    queryFn: () => getEquipmentHistory(equipmentId),
  });
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-900">History</h2>
      {history.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : history.isError ? (
        <FormError message="Could not load the history." />
      ) : history.data.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing recorded yet.</p>
      ) : (
        <ol className="space-y-2 border-l border-gray-200 pl-4">
          {history.data.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="text-gray-900">{event.summary}</p>
              <p className="text-xs text-gray-500">
                {dateTimeLabel(event.at)}
                {event.actorName ? ` · ${event.actorName}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function money(value: number | null): string {
  return value === null ? '—' : formatRupees(value);
}
