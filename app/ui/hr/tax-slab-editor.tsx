'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getTaxSlabs, setTaxSlabs, type TaxSlabBand } from '@/app/lib/api/hr-payroll';
import { financialYearOf, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

interface BandDraft {
  lowerBound: string;
  upperBound: string;
  ratePercent: string;
}

const toDraft = (band: TaxSlabBand): BandDraft => ({
  lowerBound: String(band.lowerBound),
  upperBound: band.upperBound === null ? '' : String(band.upperBound),
  ratePercent: String(band.ratePercent),
});

/**
 * Checks a slab set is contiguous and open-ended at the top.
 *
 * Evaluated in the browser because the client holds every band — it can answer
 * the question without a round trip, and naming the offending boundary is far more
 * useful than a generic rejection after submit. The backend re-checks and rejects
 * regardless; this is not a substitute for that, it is a faster way to find out.
 *
 * A gap lets income fall through untaxed and an overlap taxes it twice, which is
 * why the set is replaced whole rather than edited band by band.
 */
function contiguityError(bands: BandDraft[]): string | null {
  if (bands.length === 0) return 'A slab set needs at least one band.';

  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const lower = Number(band.lowerBound);
    const rate = Number(band.ratePercent);
    if (Number.isNaN(lower) || lower < 0) {
      return `Band ${index + 1}: the lower bound must be a number.`;
    }
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      return `Band ${index + 1}: the rate must be between 0 and 100.`;
    }
    const isLast = index === bands.length - 1;
    if (isLast) {
      if (band.upperBound.trim() !== '') {
        return 'The final band must be open-ended — leave its upper bound blank.';
      }
      continue;
    }
    const upper = Number(band.upperBound);
    if (band.upperBound.trim() === '' || Number.isNaN(upper)) {
      return `Band ${index + 1}: only the final band may be open-ended.`;
    }
    if (upper <= lower) {
      return `Band ${index + 1}: the upper bound must be above the lower bound.`;
    }
    const nextLower = Number(bands[index + 1].lowerBound);
    if (nextLower !== upper) {
      return `Bands ${index + 1} and ${index + 2} do not meet: one ends at ${rupees(
        upper,
      )} and the next starts at ${rupees(nextLower)}. Income between them would be ${
        nextLower > upper ? 'untaxed' : 'taxed twice'
      }.`;
    }
  }
  if (Number(bands[0].lowerBound) !== 0) {
    return 'The first band must start at 0.';
  }
  return null;
}

export default function TaxSlabEditor() {
  const queryClient = useQueryClient();
  const [financialYear, setFinancialYear] = useState(financialYearOf());
  const [regime, setRegime] = useState<'old' | 'new'>('new');
  const [bands, setBands] = useState<BandDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'taxSlabs', financialYear, regime],
    queryFn: () => getTaxSlabs(financialYear, regime),
  });

  // Adjusting state during render rather than in an effect: this is React's own
  // pattern for "reset local edits when the thing being edited changes", and an
  // effect here would render the previous year's bands once before correcting
  // itself. See https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [loadedFrom, setLoadedFrom] = useState<typeof data>(undefined);
  if (data !== loadedFrom) {
    setLoadedFrom(data);
    setBands(data ? data.map(toDraft) : []);
  }

  const save = useMutation({
    mutationFn: () =>
      setTaxSlabs(
        financialYear,
        regime,
        bands.map((band) => ({
          lowerBound: Number(band.lowerBound),
          upperBound: band.upperBound.trim() === '' ? null : Number(band.upperBound),
          ratePercent: Number(band.ratePercent),
        })),
      ),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'taxSlabs'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const validation = contiguityError(bands);

  function update(index: number, field: keyof BandDraft, value: string) {
    setSaved(false);
    setBands((current) =>
      current.map((band, i) => (i === index ? { ...band, [field]: value } : band)),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <TextField
          id="slab-fy"
          label="Financial year"
          value={financialYear}
          onChange={(event) => setFinancialYear(event.target.value)}
          hint="Format: 2026-27"
        />
        <SelectField
          id="slab-regime"
          label="Regime"
          value={regime}
          onChange={(event) => setRegime(event.target.value as 'old' | 'new')}
        >
          <option value="new">New</option>
          <option value="old">Old</option>
        </SelectField>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading…
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bands.map((band, index) => (
            <div
              key={index}
              className="grid items-end gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-4"
            >
              <TextField
                id={`band-lower-${index}`}
                label="From"
                type="number"
                value={band.lowerBound}
                onChange={(event) => update(index, 'lowerBound', event.target.value)}
              />
              <TextField
                id={`band-upper-${index}`}
                label="To"
                type="number"
                value={band.upperBound}
                onChange={(event) => update(index, 'upperBound', event.target.value)}
                hint={index === bands.length - 1 ? 'Leave blank — open-ended' : undefined}
              />
              <TextField
                id={`band-rate-${index}`}
                label="Rate %"
                type="number"
                step="0.01"
                value={band.ratePercent}
                onChange={(event) => update(index, 'ratePercent', event.target.value)}
              />
              <div className="flex gap-2">
                <RowAction
                  type="button"
                  onClick={() =>
                    setBands((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </RowAction>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              type="button"
              onClick={() =>
                setBands((current) => [
                  ...current,
                  {
                    // Starts where the previous band ended, so the common case is
                    // contiguous without the user having to retype the boundary.
                    lowerBound:
                      current.length > 0
                        ? current[current.length - 1].upperBound || ''
                        : '0',
                    upperBound: '',
                    ratePercent: '',
                  },
                ])
              }
            >
              Add band
            </SecondaryButton>
          </div>
        </div>
      )}

      {validation && (
        <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {validation}
        </p>
      )}
      <FormError message={error} />
      {saved && !validation && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Slabs saved for {financialYear} ({regime} regime).
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => save.mutate()}
          disabled={validation !== null || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Replace slab set'}
        </Button>
      </div>
      <p className="text-xs text-gray-600">
        The set is replaced as a whole, not edited band by band — a set is only
        meaningful complete.
      </p>
    </div>
  );
}
