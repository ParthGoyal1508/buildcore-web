'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  type BillingRates,
  getBillingRates,
  setBillingRates,
} from '@/app/lib/api/settings';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/**
 * The four statutory rates a running-account bill is computed at (025 US4, FR-021 to FR-024).
 *
 * ## Why this screen exists when nothing was wrong
 *
 * The rates have carried correct defaults since feature 023 — 9%, 9%, 18%, 2% — so no bill has ever
 * been computed incorrectly. But CGST is statute and TDS is statute, and a statute that changes on a
 * Monday cannot wait for somebody with database access. A column with a right answer and no way to
 * change it is a hardcoded value wearing a column's clothes.
 *
 * ## Percentages here, fractions on the wire
 *
 * The API stores and freezes fractions, because that is what a bill compares against a client's
 * signed paper. A contract and a statute are both written as percentages, so that is what this
 * collects — one conversion, in one place, exactly as the project's retention term does it.
 *
 * ## The sentence this screen must carry
 *
 * **Changing a rate does not move a bill that has been issued.** That is deliberate and tested:
 * issue freezes the rates onto the package so a document already sent reproduces identically. A
 * person about to change TDS needs to know which bills they are and are not affecting before they
 * press the button, not afterwards.
 */
const FIELDS: { key: keyof BillingRates; label: string }[] = [
  { key: 'cgstFraction', label: 'CGST (%)' },
  { key: 'sgstFraction', label: 'SGST (%)' },
  { key: 'igstFraction', label: 'IGST (%)' },
  { key: 'tdsFraction', label: 'Income-tax TDS (%)' },
];

const asPercent = (fraction: string): string =>
  String(Number(fraction) * 100);

export function BillingRatesScreen() {
  const companyId = useSelectedCompanyId();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['billing-rates', companyId],
    queryFn: () => getBillingRates(companyId as string),
    enabled: !!companyId,
  });

  if (!companyId) {
    return <p className="text-sm text-gray-600">Choose a company first.</p>;
  }
  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading the rates…</p>;
  }
  if (isError || !data) {
    return <FormError message="The rates could not be loaded." />;
  }

  // Keyed on the company, so switching company remounts the form rather than leaving one
  // company's draft sitting over another's saved rates. The alternative — seeding state from an
  // effect — is the shape this codebase's lint rule forbids, and for the same reason.
  return <RatesForm key={companyId} companyId={companyId} rates={data} />;
}

function RatesForm({
  companyId,
  rates,
}: {
  companyId: string;
  rates: BillingRates;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map(({ key }) => [key, asPercent(rates[key])])),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      setBillingRates(
        companyId,
        Object.fromEntries(
          FIELDS.filter(({ key }) => draft[key]?.trim() !== '').map(
            ({ key }) => [key, Number(draft[key]) / 100],
          ),
        ),
      ),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void queryClient.invalidateQueries({
        queryKey: ['billing-rates', companyId],
      });
    },
    // The server bounds each rate at 1 and says so. 9 meaning nine per cent would multiply every
    // tax on every bill by a hundred, so its refusal is worth reading rather than replacing.
    onError: (err: Error) => {
      setSaved(false);
      setError(err.message);
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        Changing a rate affects bills composed <strong>afterwards</strong>. A
        bill that has been issued keeps the rates it was issued at, so a
        document already sent to a client reproduces exactly as they received
        it.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            id={`rate-${key}`}
            label={label}
            inputMode="decimal"
            value={draft[key] ?? ''}
            onChange={(event) =>
              setDraft((current) => ({ ...current, [key]: event.target.value }))
            }
          />
        ))}
      </div>

      <FormError message={error} />
      {saved && !error && (
        <p className="text-sm text-green-800" role="status">
          Saved. Bills composed from now on use these rates.
        </p>
      )}

      <div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save the rates'}
        </Button>
      </div>
    </form>
  );
}
