'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type BankGuarantee,
  encashBankGuarantee,
  extendBankGuarantee,
  releaseBankGuarantee,
  reopenBankGuarantee,
} from '@/app/lib/api/bank-guarantees';
import { ApiError } from '@/app/lib/api/client';
import { MESSAGES } from '@/app/lib/constants';
import { dateLabel, todayIso } from '@/app/lib/format';
import { Button, DangerButton } from '@/app/ui/button';
import { amountInput, bgMoney } from '@/app/ui/projects/bank-guarantee-parts';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';

export type BgAction = 'extend' | 'release' | 'encash' | 'reopen';

const TITLES: Record<BgAction, string> = {
  extend: 'Extend guarantee',
  release: 'Mark released',
  encash: 'Mark encashed',
  reopen: 'Reopen guarantee',
};

const DONE: Record<BgAction, string> = {
  extend: 'Guarantee extended.',
  release: 'Marked released.',
  encash: 'Marked encashed.',
  reopen: 'Guarantee reopened.',
};

/**
 * The four status changes of a guarantee (037), each a short form with its date:
 *
 * - **Extend** — a later expiry; the old date stays in the history.
 * - **Release** — the department returned it.
 * - **Encash** — the department invoked it, for up to the BG amount.
 * - **Reopen** — back to Running, for a release or encashment recorded by mistake; a reason is
 *   required and kept.
 */
export default function BankGuaranteeActionModal({
  action,
  guarantee,
  onClose,
}: {
  action: BgAction;
  guarantee: BankGuarantee;
  onClose: () => void;
}) {
  const [date, setDate] = useState(action === 'extend' ? '' : todayIso());
  const [claim, setClaim] = useState(guarantee.claimPeriodEndDate ?? '');
  const [amount, setAmount] = useState(action === 'encash' ? guarantee.amount : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();
  const label = guarantee.bgNumber
    ? `${guarantee.type} ${guarantee.bgNumber}`
    : `${guarantee.type} guarantee`;

  const run = useMutation({
    mutationFn: () => {
      switch (action) {
        case 'extend':
          return extendBankGuarantee(guarantee.id, {
            expiryDate: date,
            ...(guarantee.claimPeriodEndDate ? { claimPeriodEndDate: claim || null } : {}),
            note: note.trim() || undefined,
          });
        case 'release':
          return releaseBankGuarantee(guarantee.id, {
            releasedOn: date,
            note: note.trim() || undefined,
          });
        case 'encash':
          return encashBankGuarantee(guarantee.id, {
            encashedOn: date,
            encashedAmount: amount,
            note: note.trim() || undefined,
          });
        case 'reopen':
          return reopenBankGuarantee(guarantee.id, note.trim());
      }
    },
    onSuccess: (tender) => {
      queryClient.setQueryData(['projects', 'bank-guarantees', 'tender', tender.id], tender);
      void queryClient.invalidateQueries({ queryKey: ['projects', 'bank-guarantees', 'list'] });
      toast.success(DONE[action]);
      onClose();
    },
    onError: (e) => setServerError(e instanceof ApiError ? e.message : MESSAGES.saveFailed),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    let problem: string | undefined;
    if (action === 'reopen') {
      if (!note.trim()) problem = 'Say why it is being reopened.';
    } else if (!date) {
      problem = 'Enter the date.';
    } else if (
      action === 'extend' &&
      guarantee.expiryDate &&
      date <= guarantee.expiryDate
    ) {
      problem = `Must be after the current expiry (${dateLabel(guarantee.expiryDate)}).`;
    } else if (
      action === 'encash' &&
      (!amount || Number(amount) <= 0 || Number(amount) > Number(guarantee.amount))
    ) {
      problem = `Enter an amount up to ${bgMoney(guarantee.amount)}.`;
    }
    setError(problem);
    if (!problem) run.mutate();
  }

  const dateLabelText =
    action === 'extend' ? 'New expiry date' : action === 'release' ? 'Released on' : 'Encashed on';

  return (
    <Modal
      title={TITLES[action]}
      onClose={onClose}
      isDirty={note.trim() !== '' || (action === 'extend' && date !== '')}
      pending={run.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          {action === 'encash' ? (
            <DangerButton type="submit" form="bg-action-form" loading={run.isPending}>
              {TITLES[action]}
            </DangerButton>
          ) : (
            <Button type="submit" form="bg-action-form" loading={run.isPending}>
              {TITLES[action]}
            </Button>
          )}
        </>
      }
    >
      <form id="bg-action-form" onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">{label}</span> · {bgMoney(guarantee.amount)}
          {guarantee.expiryDate && <> · expires {dateLabel(guarantee.expiryDate)}</>}
        </p>
        <FormError message={serverError} />
        {action !== 'reopen' && (
          <TextField
            id="bg-action-date"
            label={dateLabelText}
            type="date"
            value={date}
            min={action === 'extend' ? guarantee.expiryDate ?? undefined : undefined}
            max={action === 'extend' ? undefined : todayIso()}
            onChange={(e) => setDate(e.target.value)}
            error={action === 'encash' ? undefined : error}
            aria-required
          />
        )}
        {action === 'extend' && guarantee.claimPeriodEndDate && (
          <TextField
            id="bg-action-claim"
            label="Claim period end date"
            type="date"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            hint="Move it too if the extension changes it; it cannot be before the new expiry."
          />
        )}
        {action === 'encash' && (
          <TextField
            id="bg-action-amount"
            label="Amount encashed (₹)"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(amountInput(e.target.value))}
            error={error}
            aria-required
          />
        )}
        <TextField
          id="bg-action-note"
          label={action === 'reopen' ? 'Reason' : 'Note'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={action === 'reopen' ? error : undefined}
          hint={
            action === 'reopen'
              ? 'Kept in the guarantee’s history.'
              : 'Optional — e.g. the department’s letter reference.'
          }
          aria-required={action === 'reopen' || undefined}
        />
      </form>
    </Modal>
  );
}
