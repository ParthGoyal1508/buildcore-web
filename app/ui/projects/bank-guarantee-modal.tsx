'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  BG_TYPES,
  type BankGuarantee,
  type BgTender,
  type BgType,
  createBankGuarantee,
  updateBankGuarantee,
  uploadBankGuaranteeDocument,
} from '@/app/lib/api/bank-guarantees';
import { ApiError } from '@/app/lib/api/client';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import FileUpload, { type PreparedFile } from '@/app/ui/file-upload';
import { amountInput } from '@/app/ui/projects/bank-guarantee-parts';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';

const TYPE_LABELS: Record<BgType, string> = {
  EMD: 'EMD — earnest money',
  PBG: 'PBG — performance guarantee',
};

interface Fields {
  type: BgType;
  bgNumber: string;
  amount: string;
  issueDate: string;
  expiryDate: string;
  claimPeriodEndDate: string;
  issuingBank: string;
  issuingBranch: string;
  marginAmount: string;
  fdReference: string;
  remarks: string;
}

function fieldsOf(bg: BankGuarantee | null, type: BgType): Fields {
  return {
    type: bg?.type ?? type,
    bgNumber: bg?.bgNumber ?? '',
    amount: bg?.amount ?? '',
    issueDate: bg?.issueDate ?? '',
    expiryDate: bg?.expiryDate ?? '',
    claimPeriodEndDate: bg?.claimPeriodEndDate ?? '',
    issuingBank: bg?.issuingBank ?? '',
    issuingBranch: bg?.issuingBranch ?? '',
    marginAmount: bg?.marginAmount ?? '',
    fdReference: bg?.fdReference ?? '',
    remarks: bg?.remarks ?? '',
  };
}

/** The checks the api makes, here so they show against the field before saving. */
function errorsOf(f: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!f.amount || Number(f.amount) <= 0) errors.amount = 'Enter the BG amount.';
  if (f.bgNumber.trim()) {
    if (!f.issueDate) errors.issueDate = 'Required once the BG number is entered.';
    if (!f.expiryDate) errors.expiryDate = 'Required once the BG number is entered.';
  }
  if (f.issueDate && f.expiryDate && f.expiryDate < f.issueDate) {
    errors.expiryDate = 'Cannot be before the issue date.';
  }
  if (f.claimPeriodEndDate) {
    if (!f.expiryDate) errors.claimPeriodEndDate = 'Needs an expiry date.';
    else if (f.claimPeriodEndDate < f.expiryDate) {
      errors.claimPeriodEndDate = 'Cannot be before the expiry date.';
    }
  }
  return errors;
}

/**
 * Add or edit one EMD or PBG guarantee (037).
 *
 * The client's sheet columns come first; the four extras the client asked for (bank and
 * branch, claim period, margin money / FD, remarks) sit below under "More details", every one
 * optional. On add, the scanned BG copy can be attached in the same step.
 */
export default function BankGuaranteeModal({
  tenderId,
  guarantee,
  defaultType = 'EMD',
  onClose,
}: {
  tenderId: string;
  guarantee: BankGuarantee | null;
  defaultType?: BgType;
  onClose: () => void;
}) {
  const initial = fieldsOf(guarantee, defaultType);
  const [f, setF] = useState<Fields>(initial);
  const [touched, setTouched] = useState(false);
  const [copy, setCopy] = useState<PreparedFile | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [numberError, setNumberError] = useState<string | undefined>();
  const [moreOpen, setMoreOpen] = useState(
    Boolean(
      guarantee?.issuingBank ||
        guarantee?.claimPeriodEndDate ||
        guarantee?.marginAmount ||
        guarantee?.fdReference ||
        guarantee?.remarks,
    ),
  );
  const queryClient = useQueryClient();
  const toast = useToast();

  const set = (key: keyof Fields) => (value: string) =>
    setF((current) => ({ ...current, [key]: value }));
  const errors = touched ? errorsOf(f) : {};
  const isDirty = JSON.stringify(f) !== JSON.stringify(initial) || copy !== null;

  const save = useMutation({
    mutationFn: async (): Promise<BgTender> => {
      // `null` clears on edit; on add a blank is left out.
      const blank = guarantee ? null : undefined;
      const body = {
        bgNumber: f.bgNumber.trim() || blank,
        amount: f.amount,
        issueDate: f.issueDate || blank,
        expiryDate: f.expiryDate || blank,
        claimPeriodEndDate: f.claimPeriodEndDate || blank,
        issuingBank: f.issuingBank.trim() || blank,
        issuingBranch: f.issuingBranch.trim() || blank,
        marginAmount: f.marginAmount || blank,
        fdReference: f.fdReference.trim() || blank,
        remarks: f.remarks.trim() || blank,
      };
      if (guarantee) return updateBankGuarantee(guarantee.id, body);
      const before = new Set(
        (queryClient.getQueryData<BgTender>(['projects', 'bank-guarantees', 'tender', tenderId])
          ?.guarantees ?? []).map((g) => g.id),
      );
      const tender = await createBankGuarantee(tenderId, { type: f.type, ...body });
      if (!copy) return tender;
      // The new guarantee is the one that was not there before.
      const created = tender.guarantees.find((g) => !before.has(g.id) && g.type === f.type);
      if (!created) return tender;
      try {
        return await uploadBankGuaranteeDocument(created.id, {
          title: 'BG copy',
          data: copy.base64,
          contentType: copy.mimeType,
          fileName: copy.fileName,
        });
      } catch {
        toast.error('The guarantee was saved, but the BG copy did not upload. Attach it again below.');
        return tender;
      }
    },
    onSuccess: (tender) => {
      queryClient.setQueryData(['projects', 'bank-guarantees', 'tender', tenderId], tender);
      void queryClient.invalidateQueries({ queryKey: ['projects', 'bank-guarantees', 'list'] });
      toast.success(guarantee ? 'Guarantee saved.' : 'Guarantee added.');
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'BG_NUMBER_TAKEN') {
        setNumberError(error.message);
        return;
      }
      setServerError(error instanceof ApiError ? error.message : MESSAGES.saveFailed);
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    setServerError(null);
    setNumberError(undefined);
    if (Object.keys(errorsOf(f)).length > 0) return;
    save.mutate();
  }

  return (
    <Modal
      title={guarantee ? `Edit ${guarantee.type} guarantee` : 'Add bank guarantee'}
      onClose={onClose}
      isDirty={isDirty}
      pending={save.isPending}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="bg-form" loading={save.isPending}>
            {save.isPending ? 'Saving…' : guarantee ? 'Save' : 'Add guarantee'}
          </Button>
        </>
      }
    >
      <form id="bg-form" onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={serverError} />
        <div className="grid gap-4 sm:grid-cols-2">
          {guarantee ? (
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">Type</span>
              <span className="flex min-h-10 items-center text-sm text-gray-900">
                {TYPE_LABELS[guarantee.type]}
              </span>
            </div>
          ) : (
            <SelectField
              id="bg-type"
              label="Type"
              value={f.type}
              onChange={(e) => set('type')(e.target.value)}
            >
              {BG_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </SelectField>
          )}
          <TextField
            id="bg-amount"
            label="BG amount (₹)"
            inputMode="decimal"
            value={f.amount}
            onChange={(e) => set('amount')(amountInput(e.target.value))}
            error={errors.amount}
            aria-required
          />
          <TextField
            id="bg-number"
            label="BG number"
            value={f.bgNumber}
            onChange={(e) => set('bgNumber')(e.target.value.toUpperCase())}
            error={numberError}
            hint="Leave blank while the guarantee is applied for."
          />
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="bg-issue"
              label="Issue date"
              type="date"
              value={f.issueDate}
              onChange={(e) => set('issueDate')(e.target.value)}
              error={errors.issueDate}
            />
            <TextField
              id="bg-expiry"
              label="Expiry date"
              type="date"
              value={f.expiryDate}
              onChange={(e) => set('expiryDate')(e.target.value)}
              error={errors.expiryDate}
            />
          </div>
        </div>

        <div className="rounded-md border border-gray-200">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="bg-more"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            More details (optional)
            <span aria-hidden="true">{moreOpen ? '−' : '+'}</span>
          </button>
          {moreOpen && (
            <div id="bg-more" className="grid gap-4 border-t border-gray-200 p-3 sm:grid-cols-2">
              <TextField
                id="bg-bank"
                label="Issuing bank"
                value={f.issuingBank}
                onChange={(e) => set('issuingBank')(e.target.value)}
              />
              <TextField
                id="bg-branch"
                label="Branch"
                value={f.issuingBranch}
                onChange={(e) => set('issuingBranch')(e.target.value)}
              />
              <TextField
                id="bg-claim"
                label="Claim period end date"
                type="date"
                value={f.claimPeriodEndDate}
                onChange={(e) => set('claimPeriodEndDate')(e.target.value)}
                error={errors.claimPeriodEndDate}
                hint="If the department can still claim after expiry. Alerts then run to this date."
              />
              <TextField
                id="bg-margin"
                label="Margin money (₹)"
                inputMode="decimal"
                value={f.marginAmount}
                onChange={(e) => set('marginAmount')(amountInput(e.target.value))}
              />
              <TextField
                id="bg-fd"
                label="FD reference"
                value={f.fdReference}
                onChange={(e) => set('fdReference')(e.target.value)}
              />
              <TextField
                id="bg-remarks"
                label="Remarks"
                value={f.remarks}
                onChange={(e) => set('remarks')(e.target.value)}
              />
            </div>
          )}
        </div>

        {!guarantee && (
          <FileUpload
            label="BG copy (optional)"
            hint="The scanned guarantee — PDF or photo. More documents can be added later."
            onSelect={setCopy}
          />
        )}
      </form>
    </Modal>
  );
}
