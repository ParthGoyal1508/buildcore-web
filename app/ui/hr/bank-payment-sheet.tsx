'use client';

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadSalaryBankSheet,
  getSalaryBankSheetPreview,
  type BankSheetPreview,
  type SalaryBankSheetQuery,
  unsubmittedRunOf,
} from '@/app/lib/api/hr-payroll';
import { ROUTES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import {
  CompanyMonthFields,
  thisMonth,
  yearMonthOf,
} from '@/app/ui/hr/company-month-fields';
import BankSheetHistory from '@/app/ui/hr/bank-sheet-history';
import SubmitRunApproval from '@/app/ui/hr/submit-run-approval';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Generate Bank Payment Sheet (2026-10-17): pick the month, company and debit account, check it,
 * then download the file in the bank's own upload format. The check comes first and says who will
 * not be paid by this file and why — missing or invalid account number, IFSC or account holder name
 * — so they can be fixed before payment day, or left off on purpose. The count and total are shown
 * here and matched to payroll net pay; the bank file itself carries no total row, because the bank
 * reads every row as a payment.
 */
export default function BankPaymentSheet() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(thisMonth);
  const [companyId, setCompanyId] = useState('');
  const [debitAccount, setDebitAccount] = useState('');
  const [preview, setPreview] = useState<BankSheetPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unsubmittedRun, setUnsubmittedRun] = useState<string | null>(null);

  const query = (): SalaryBankSheetQuery => ({
    ...yearMonthOf(month),
    ...(companyId ? { companyId } : {}),
    ...(debitAccount.trim() ? { debitAccount: debitAccount.trim() } : {}),
  });

  const messageOf = (e: unknown, fallback: string) =>
    e instanceof ApiError && e.status < 500 ? e.message : fallback;

  const check = useMutation({
    mutationFn: () => getSalaryBankSheetPreview(query()),
    onSuccess: (p) => {
      setPreview(p);
      if (!debitAccount) setDebitAccount(p.debitAccount);
    },
    onError: (e) => {
      setPreview(null);
      setError(messageOf(e, 'Could not check the payroll for that month.'));
      setUnsubmittedRun(unsubmittedRunOf(e));
    },
  });

  const download = useMutation({
    mutationFn: () => downloadSalaryBankSheet(query()),
    onSuccess: ({ blob, filename }) => {
      saveBlob(blob, filename);
      void queryClient.invalidateQueries({ queryKey: ['hr', 'bank-sheet-history'] });
    },
    onError: (e) => setError(messageOf(e, 'Could not create the bank sheet.')),
  });

  // Anything that changes the file invalidates the check.
  const reset = () => {
    setPreview(null);
    setError(null);
    setUnsubmittedRun(null);
  };

  const debitInvalid =
    debitAccount.trim() !== '' && !/^\d{6,20}$/.test(debitAccount.trim())
      ? 'The debit account number should be 6 to 20 digits.'
      : undefined;

  const bankIssues = preview?.leftOff.filter((l) => l.kind === 'bank_details') ?? [];
  const otherLeftOff = preview?.leftOff.filter((l) => l.kind !== 'bank_details') ?? [];

  return (
    <section
      aria-labelledby="bank-payment-sheet"
      className="mb-6 rounded-lg border border-gray-200 bg-white p-4"
    >
      <h2 id="bank-payment-sheet" className="text-sm font-semibold text-gray-900">
        Generate Bank Payment Sheet
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Finalised payroll only, net pay above zero, in the bank&rsquo;s upload format.
      </p>
      <FormError message={error} />
      {unsubmittedRun && (
        <div className="mt-2">
          <SubmitRunApproval runId={unsubmittedRun} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompanyMonthFields
          idPrefix="bps"
          month={month}
          onMonth={(v) => {
            setMonth(v);
            reset();
          }}
          companyId={companyId}
          onCompany={(v) => {
            setCompanyId(v);
            setDebitAccount('');
            reset();
          }}
        />
        <TextField
          id="bps-debit"
          label="Debit account"
          inputMode="numeric"
          placeholder="The company's payroll account"
          value={debitAccount}
          onChange={(e) => {
            setDebitAccount(e.target.value);
            reset();
          }}
          error={debitInvalid}
          hint={
            preview?.defaultDebitAccount && debitAccount !== preview.defaultDebitAccount
              ? `Company default: ${preview.defaultDebitAccount}`
              : undefined
          }
        />
        <div className="flex items-start pt-6">
          <SecondaryButton
            className="w-full justify-center"
            disabled={!month || !!debitInvalid || check.isPending}
            onClick={() => {
              setError(null);
              setUnsubmittedRun(null);
              check.mutate();
            }}
          >
            {check.isPending ? 'Checking…' : 'Check'}
          </SecondaryButton>
        </div>
      </div>

      {preview && (
        <div className="mt-4 space-y-4">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Employees on the sheet" value={String(preview.employeeCount)} />
            <Figure label="Total to transfer" value={formatRupees(preview.transferTotal)} />
            <Figure label="Payroll net pay" value={formatRupees(preview.payrollNetTotal)} />
            <Figure
              label="Left off / advances recovered"
              value={`${formatRupees(preview.leftOffTotal)} / ${formatRupees(preview.recoveredTotal)}`}
            />
          </dl>
          <p
            role="status"
            className={clsx(
              'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
              preview.reconciles ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900',
            )}
          >
            {preview.reconciles ? (
              <CheckCircleIcon className="mt-0.5 w-5 flex-none" aria-hidden="true" />
            ) : (
              <ExclamationTriangleIcon className="mt-0.5 w-5 flex-none" aria-hidden="true" />
            )}
            {preview.reconciles
              ? 'The sheet, plus everyone left off and any advance recovered, matches the payroll net pay.'
              : 'The sheet does not add up to the payroll net pay. Do not upload it — tell the payroll team.'}
          </p>

          {bankIssues.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-sm font-semibold text-amber-900">
                {bankIssues.length} employee{bankIssues.length === 1 ? '' : 's'} cannot be paid by
                this file — fix their bank details, or pay them another way
              </h3>
              <ul className="mt-2 divide-y divide-amber-100 text-sm">
                {bankIssues.map((l) => (
                  <li key={l.employeeId} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span>
                      <span className="font-medium">{l.name}</span>{' '}
                      <span className="text-xs text-gray-600">{l.employeeCode}</span> ·{' '}
                      {formatRupees(l.netPay)}
                      <span className="block text-xs text-amber-900">{l.reason}</span>
                    </span>
                    <Link
                      href={ROUTES.hrEmployee(l.employeeId)}
                      className="text-xs text-brand-700 underline"
                    >
                      Fix bank details
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {otherLeftOff.length > 0 && (
            <details className="rounded-md border border-gray-200 p-3 text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">
                Also left off ({otherLeftOff.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {otherLeftOff.map((l) => (
                  <li key={l.employeeId} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {l.name} <span className="text-xs text-gray-500">{l.employeeCode}</span> —{' '}
                      {l.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                setError(null);
                download.mutate();
              }}
              disabled={!preview.reconciles || preview.employeeCount === 0 || download.isPending}
            >
              {download.isPending ? 'Excel…' : 'Download bank sheet'}
            </Button>
            <span className="text-xs text-gray-500">
              Downloading records any salary advance recovered from these transfers.
            </span>
          </div>
        </div>
      )}
      <BankSheetHistory key={`${companyId}|${month}`} companyId={companyId} month={month} />
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
