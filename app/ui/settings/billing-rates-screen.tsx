'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  type BillingRates,
  getBillingRates,
  setBillingRates,
} from '@/app/lib/api/settings';
import { errorMessage } from '@/app/lib/api/client';
import { Button } from '@/app/ui/button';
import QueryError from '@/app/ui/query-error';
import { FormError, TextField } from '@/app/ui/settings/form-fields';
import { toast } from '@/app/ui/toast';

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

/**
 * A stored fraction as the percentage typed. Rounded to six decimal places and trimmed (036 C12):
 * `0.14 * 100` is `14.000000000000002` in floating point, which is what the box showed.
 */
const asPercent = (fraction: string): string =>
  String(Number((Number(fraction) * 100).toFixed(6)));

/** A typed percentage, or why it cannot be saved (036 C12): "abc" used to be sent as null. */
function percentError(raw: string | undefined): string | undefined {
  const text = raw?.trim() ?? '';
  if (text === '') return 'Enter a rate';
  if (!/^\d+(\.\d+)?$/.test(text)) return 'Enter a number, e.g. 9 or 2.5';
  const value = Number(text);
  if (value < 0 || value > 100) return 'Must be between 0 and 100';
  return undefined;
}

export function BillingRatesScreen() {
  const companyId = useSelectedCompanyId();

  const { data, isLoading, isError, error, refetch } = useQuery({
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
    return (
      <QueryError
        error={error}
        onRetry={refetch}
        fallback="The rates could not be loaded."
      />
    );
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
  const [touched, setTouched] = useState(false);
  const fieldErrors = Object.fromEntries(
    FIELDS.map(({ key }) => [key, percentError(draft[key])]),
  );
  const invalid = Object.values(fieldErrors).some(Boolean);

  const save = useMutation({
    mutationFn: () =>
      setBillingRates(
        companyId,
        Object.fromEntries(
          // Divided and rounded back to the fraction's own precision, so 14 is sent as 0.14 and
          // not as 0.14000000000000001.
          FIELDS.map(({ key }) => [
            key,
            Number((Number(draft[key]) / 100).toFixed(8)),
          ]),
        ),
      ),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      toast.success('Billing rates saved.');
      void queryClient.invalidateQueries({
        queryKey: ['billing-rates', companyId],
      });
    },
    // The server bounds each rate at 1 and says so. 9 meaning nine per cent would multiply every
    // tax on every bill by a hundred, so its refusal is worth reading rather than replacing.
    onError: (err: unknown) => {
      setSaved(false);
      setError(errorMessage(err, 'The rates could not be saved.'));
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (invalid) return;
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
            aria-required="true"
            value={draft[key] ?? ''}
            error={touched ? fieldErrors[key] : undefined}
            onChange={(event) => {
              // "Saved" described the values before this edit, not these (036 C12).
              setSaved(false);
              setDraft((current) => ({ ...current, [key]: event.target.value }));
            }}
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
        <Button type="submit" loading={save.isPending}>
          Save the rates
        </Button>
      </div>
    </form>
  );
}
