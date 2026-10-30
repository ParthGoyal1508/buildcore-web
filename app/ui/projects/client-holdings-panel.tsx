'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  clientHoldingKeys,
  getClientHoldings,
  recordClientHoldRelease,
  type ClientHoldings,
} from '@/app/lib/api/client-holdings';
import { percentLabel } from '@/app/lib/bill-totals';
import { CLIENT_HOLDINGS_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { projectErrorMessage } from '@/app/ui/projects/project-lock-context';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { TABLE } from '@/app/ui/table';
import { useToast } from '@/app/ui/toast';

/**
 * What the client is holding of ours on this project (048): retention withheld and released,
 * CPBG deducted and refunded, running PBGs, and a flag when CPBG is still held after a PBG went in.
 *
 * Its own request, because it needs `PROJECT_FINANCIALS` and the overview does not. A reader
 * without that permission gets a 403 and the panel is simply absent — not an error box about money
 * they were never meant to see.
 */
export default function ClientHoldingsPanel({
  projectId,
  isLocked,
}: {
  projectId: string;
  isLocked: boolean;
}) {
  const [releasing, setReleasing] = useState(false);
  const { data, error } = useQuery({
    queryKey: clientHoldingKeys.project(projectId),
    queryFn: () => getClientHoldings(projectId),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status === 403) && count < 2,
  });

  if (error instanceof ApiError && error.status === 403) return null;
  if (error) return <FormError message={CLIENT_HOLDINGS_COPY.loadFailed} />;
  if (!data) return null;

  const anyHeld = data.retention.held > 0 || data.cpbg.held > 0;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {CLIENT_HOLDINGS_COPY.heldHeading}
          </h2>
          <p className="max-w-2xl text-xs text-gray-500">
            {CLIENT_HOLDINGS_COPY.heldHint}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{CLIENT_HOLDINGS_COPY.heldTotal}</p>
          <p className="text-lg font-semibold tabular-nums text-gray-900">
            {rupees(data.totalHeld)}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-600">
        {CLIENT_HOLDINGS_COPY.receivedTotal(rupees(data.received), data.receiptCount)}
      </p>

      <div className={clsx(TABLE.wrap, 'mt-3')}>
        <table className={clsx(TABLE.table, 'w-full')}>
          <thead className={TABLE.thead}>
            <tr>
              <th scope="col" className={TABLE.th}>
                <span className="sr-only">Kind</span>
              </th>
              <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                {CLIENT_HOLDINGS_COPY.withheld}
              </th>
              <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                {CLIENT_HOLDINGS_COPY.released}
              </th>
              <th scope="col" className={clsx(TABLE.th, 'text-right')}>
                {CLIENT_HOLDINGS_COPY.held}
              </th>
            </tr>
          </thead>
          <tbody>
            <HeldRow
              label={CLIENT_HOLDINGS_COPY.retention}
              term={
                data.clientRetentionFraction === null
                  ? null
                  : CLIENT_HOLDINGS_COPY.termRetention(
                      percentLabel(data.clientRetentionFraction),
                    )
              }
              figures={[
                data.retention.withheld,
                data.retention.released,
                data.retention.held,
              ]}
            />
            <HeldRow
              label={CLIENT_HOLDINGS_COPY.cpbg}
              term={
                data.clientCpbgFraction === null
                  ? null
                  : CLIENT_HOLDINGS_COPY.termCpbg(
                      percentLabel(data.clientCpbgFraction),
                    )
              }
              figures={[data.cpbg.deducted, data.cpbg.refunded, data.cpbg.held]}
            />
          </tbody>
        </table>
      </div>

      {data.cpbgRefundDue && (
        <p
          role="status"
          className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {CLIENT_HOLDINGS_COPY.refundDue(rupees(data.cpbg.held))}
        </p>
      )}

      <div className="mt-3">
        <h3 className="text-xs uppercase tracking-wide text-gray-500">
          {CLIENT_HOLDINGS_COPY.pbgHeading}
        </h3>
        {data.runningPbgs.length === 0 ? (
          <p className="text-sm text-gray-600">{CLIENT_HOLDINGS_COPY.noPbg}</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-gray-800">
            {data.runningPbgs.map((pbg) => (
              <li key={pbg.id}>
                {pbg.bgNumber} · {rupees(pbg.amount)}
                {pbg.issuingBank ? ` · ${pbg.issuingBank}` : ''}
                {pbg.expiryDate ? ` · expires ${dateLabel(pbg.expiryDate)}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.releases.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs uppercase tracking-wide text-gray-500">
            {CLIENT_HOLDINGS_COPY.releasesHeading}
          </h3>
          <ul className="mt-1 space-y-1 text-sm text-gray-800">
            {data.releases.map((release) => (
              <li key={release.id}>
                {dateLabel(release.releasedOn)} ·{' '}
                {CLIENT_HOLDINGS_COPY.releaseKinds[release.kind]} ·{' '}
                <span className="tabular-nums">{rupees(release.amount)}</span> ·{' '}
                {release.reason}
                {release.bgNumber ? ` · PBG ${release.bgNumber}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLocked && anyHeld && (
        <SecondaryButton
          type="button"
          className="mt-3"
          onClick={() => setReleasing(true)}
        >
          {CLIENT_HOLDINGS_COPY.releaseButton}
        </SecondaryButton>
      )}

      {releasing && (
        <ReleaseModal
          projectId={projectId}
          holdings={data}
          onClose={() => setReleasing(false)}
        />
      )}
    </section>
  );
}

function HeldRow({
  label,
  term,
  figures,
}: {
  label: string;
  term: string | null;
  figures: [number, number, number];
}) {
  return (
    <tr className={TABLE.row}>
      <th scope="row" className={clsx(TABLE.td, 'text-left font-medium text-gray-800')}>
        {label}
        {term && (
          <span className="block text-xs font-normal text-gray-500">{term}</span>
        )}
      </th>
      {figures.map((value, index) => (
        <td
          key={index}
          className={clsx(
            TABLE.td,
            TABLE.numeric,
            index === 2 && 'font-semibold text-gray-900',
          )}
        >
          {rupees(value)}
        </td>
      ))}
    </tr>
  );
}

function ReleaseModal({
  projectId,
  holdings,
  onClose,
}: {
  projectId: string;
  holdings: ClientHoldings;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<'retention' | 'cpbg'>(
    holdings.retention.held > 0 ? 'retention' : 'cpbg',
  );
  const held = kind === 'retention' ? holdings.retention.held : holdings.cpbg.held;
  const [amount, setAmount] = useState(String(held));
  const [releasedOn, setReleasedOn] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [guaranteeId, setGuaranteeId] = useState(
    kind === 'cpbg' && holdings.runningPbgs.length === 1
      ? holdings.runningPbgs[0].id
      : '',
  );
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const over = Number.isFinite(value) && value - held > 0.004;
  const invalid = !/^\d+(\.\d{0,2})?$/.test(amount.trim()) || value <= 0;

  const save = useMutation({
    mutationFn: () =>
      recordClientHoldRelease(projectId, {
        kind,
        amount: value,
        releasedOn,
        reason: reason.trim(),
        ...(kind === 'cpbg' && guaranteeId ? { bankGuaranteeId: guaranteeId } : {}),
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(clientHoldingKeys.project(projectId), next);
      toast.success(CLIENT_HOLDINGS_COPY.releaseSaved);
      onClose();
    },
    onError: (err: Error) => setError(projectErrorMessage(err)),
  });

  return (
    <Modal
      title={CLIENT_HOLDINGS_COPY.releaseTitle}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            loading={save.isPending}
            disabled={save.isPending || invalid || over || !reason.trim() || !releasedOn}
            onClick={() => save.mutate()}
          >
            {CLIENT_HOLDINGS_COPY.releaseSave}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelectField
          id="release-kind"
          label={CLIENT_HOLDINGS_COPY.releaseKind}
          value={kind}
          onChange={(event) => {
            const next = event.target.value as 'retention' | 'cpbg';
            setKind(next);
            setAmount(
              String(next === 'retention' ? holdings.retention.held : holdings.cpbg.held),
            );
          }}
        >
          <option value="retention" disabled={holdings.retention.held <= 0}>
            {CLIENT_HOLDINGS_COPY.releaseKinds.retention} (held{' '}
            {rupees(holdings.retention.held)})
          </option>
          <option value="cpbg" disabled={holdings.cpbg.held <= 0}>
            {CLIENT_HOLDINGS_COPY.releaseKinds.cpbg} (held {rupees(holdings.cpbg.held)})
          </option>
        </SelectField>
        <TextField
          id="release-amount"
          label={CLIENT_HOLDINGS_COPY.releaseAmount}
          inputMode="decimal"
          value={amount}
          error={over ? CLIENT_HOLDINGS_COPY.releaseOver(rupees(held)) : undefined}
          onChange={(event) => setAmount(event.target.value)}
        />
        <TextField
          id="release-on"
          type="date"
          label={CLIENT_HOLDINGS_COPY.releaseOn}
          value={releasedOn}
          onChange={(event) => setReleasedOn(event.target.value)}
        />
        <TextField
          id="release-reason"
          label={CLIENT_HOLDINGS_COPY.releaseReason}
          hint={CLIENT_HOLDINGS_COPY.releaseReasonHint}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {kind === 'cpbg' && (
          <SelectField
            id="release-guarantee"
            label={CLIENT_HOLDINGS_COPY.releaseGuarantee}
            value={guaranteeId}
            onChange={(event) => setGuaranteeId(event.target.value)}
          >
            <option value="">{CLIENT_HOLDINGS_COPY.releaseGuaranteeNone}</option>
            {holdings.runningPbgs.map((pbg) => (
              <option key={pbg.id} value={pbg.id}>
                {pbg.bgNumber} · {rupees(pbg.amount)}
              </option>
            ))}
          </SelectField>
        )}
        <FormError message={error} />
      </div>
    </Modal>
  );
}
