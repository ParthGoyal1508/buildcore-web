'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  setPunchAccuracy,
  setPunchEnforcement,
  type Company,
} from '@/app/lib/api/settings';
import { Button } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';
import { toast } from '@/app/ui/toast';

/** The backend's own bound (`SetPunchAccuracyDto`): a threshold of a billion metres would accept
 * every punch on Earth, which is the opposite of what a threshold is for. */
const MAX_ACCURACY_METRES = 10_000;

/**
 * Face-punch settings for one company (020 FR-012b / FR-013, surfaced 042).
 *
 * Two decisions, saved separately because they are separate acts: how bad a GPS fix may be
 * before a punch cannot be located, and whether a punch that fails location or face validation
 * is refused outright instead of recorded as an exception. Each takes effect on the next punch,
 * with no restart.
 *
 * The accuracy field left empty is "no decision" — the company follows the product default,
 * which only the API knows. That is a different act from typing the default's current value: a
 * cleared company follows the default if it ever changes.
 */
export default function PunchSettingsPanel({ company }: { company: Company }) {
  const queryClient = useQueryClient();
  const [metres, setMetres] = useState(
    company.punchAccuracyMaxMetres == null
      ? ''
      : String(company.punchAccuracyMaxMetres),
  );
  const [enforced, setEnforced] = useState(company.punchBlockEnforced ?? false);
  const [accuracyError, setAccuracyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveAccuracy = useMutation({
    mutationFn: (value: number | null) => setPunchAccuracy(company.id, value),
    onSuccess: async (saved) => {
      setError(null);
      toast.success(
        saved.punchAccuracyMaxMetres === null
          ? `Cleared — punches follow the product default, currently ${saved.effective} m.`
          : `Saved. A punch reporting worse than ${saved.effective} m accuracy cannot be located.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: unknown) =>
      setError(errorMessage(err, 'The accuracy limit could not be saved.')),
  });

  const saveEnforcement = useMutation({
    mutationFn: () => setPunchEnforcement(company.id, enforced),
    onSuccess: async (saved) => {
      setError(null);
      toast.success(
        saved.punchBlockEnforced
          ? 'Saved. A punch that fails location or face validation is now refused outright.'
          : 'Saved. A failing punch is recorded as an exception for an admin again.',
      );
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
    onError: (err: unknown) =>
      setError(errorMessage(err, 'The punch enforcement could not be saved.')),
  });

  const submitAccuracy = () => {
    const raw = metres.trim();
    if (raw === '') {
      setAccuracyError(null);
      saveAccuracy.mutate(null);
      return;
    }
    const value = Number(raw);
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > MAX_ACCURACY_METRES
    ) {
      setAccuracyError(
        `A whole number of metres between 0 and ${MAX_ACCURACY_METRES.toLocaleString('en-IN')} — or leave it empty to follow the product default.`,
      );
      return;
    }
    setAccuracyError(null);
    saveAccuracy.mutate(value);
  };

  return (
    <div className="space-y-6">
      <FormError message={error} />

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            Punch location accuracy
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            The worst GPS accuracy a punch may report and still be located.
            Takes effect on the next punch.
          </p>
        </div>
        <div className="max-w-md space-y-3">
          <TextField
            id="punch-accuracy"
            label="Accuracy limit (metres)"
            type="number"
            min={0}
            max={MAX_ACCURACY_METRES}
            value={metres}
            error={accuracyError ?? undefined}
            placeholder="Uses the product default"
            hint="Leave empty to follow the product default — different from setting it to the default’s current value, which freezes it."
            onChange={(event) => setMetres(event.target.value)}
          />
          <Button
            type="button"
            loading={saveAccuracy.isPending}
            onClick={submitAccuracy}
          >
            Save
          </Button>
        </div>
      </section>

      <section className="space-y-3 border-t border-gray-200 pt-5">
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            Refuse failing punches
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            While off — the default — a punch that fails location or face
            validation is recorded as an exception for an admin, and the
            would-be refusal is logged so the rate can be measured. While on,
            the punch is refused and nothing is written to attendance at all.
            The refusals log under HR → Attendance keeps the same shape either
            way, so before and after are directly comparable.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={enforced}
            onChange={(event) => setEnforced(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-accent-500"
          />
          Refuse a punch that fails location or face validation
        </label>
        <Button
          type="button"
          loading={saveEnforcement.isPending}
          onClick={() => saveEnforcement.mutate()}
        >
          Save
        </Button>
      </section>
    </div>
  );
}
