'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  getNumbering,
  type NumberingEntry,
  resetNumbering,
  setNumbering,
} from '@/app/lib/api/settings';
import { Button } from '@/app/ui/button';
import { confirmDialog } from '@/app/ui/dialogs';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/** Same rendering as the server's `formatCode`, for the live preview while typing. */
function counted(prefix: string, base: number, step: number, width: number) {
  return [1, 2, 3].map(
    (n) => prefix + String(base + n * step).padStart(width, '0'),
  );
}

/** Same rendering as the server's `namedCode`. */
function named(width: number, separator: string) {
  const code = (prefix: string, serial: number, year: number) =>
    `${prefix}${String(serial).padStart(width, '0')}${separator}${year}`;
  return [code('JCB', 1, 2027), code('TM', 1, 2024), code('JCB', 2, 2025)];
}

/**
 * Settings → Numbering (2026-10-15). The client: "Can we give a setting to configure the Project
 * Code, Vendor Code, Work Order Number, Plant and Machinery and Assets".
 *
 * Three counted series — a fixed prefix, a start, a gap, a number of digits — and two named ones,
 * machines and assets, whose code is letters from the name, a serial and the manufacturing year.
 * Every field previews as it is typed, so the person setting it sees `1010, 1020, 1030` before
 * saving rather than after the next project is created.
 */
export function NumberingScreen() {
  const companyId = useSelectedCompanyId();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['numbering', companyId],
    queryFn: () => getNumbering(companyId as string),
    enabled: !!companyId,
  });

  if (!companyId) {
    return (
      <p className="text-sm text-gray-600">
        Choose a company in the header to set its numbering.
      </p>
    );
  }
  if (isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Could not load the numbering settings.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {data.map((entry) => (
        <SeriesCard
          // Remounted on save, so the fields start from what the server now holds.
          key={`${entry.series}-${entry.prefix}-${entry.base}-${entry.step}-${entry.width}-${entry.separator}`}
          companyId={companyId}
          entry={entry}
        />
      ))}
    </div>
  );
}

function SeriesCard({
  companyId,
  entry,
}: {
  companyId: string;
  entry: NumberingEntry;
}) {
  const queryClient = useQueryClient();
  const [prefix, setPrefix] = useState(entry.prefix);
  const [base, setBase] = useState(String(entry.base));
  const [step, setStep] = useState(String(entry.step));
  const [width, setWidth] = useState(String(entry.width));
  const [separator, setSeparator] = useState(entry.separator);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isCounted = entry.kind === 'counted';
  const valid = isCounted
    ? /^\d+$/.test(base) && /^\d+$/.test(step) && Number(step) >= 1
    : /^\d+$/.test(width);
  const preview = !valid
    ? []
    : isCounted
      ? counted(prefix.trim(), Number(base), Number(step), Number(width || 0))
      : named(Number(width), separator);
  const changed = isCounted
    ? prefix.trim() !== entry.prefix ||
      Number(base) !== entry.base ||
      Number(step) !== entry.step ||
      Number(width || 0) !== entry.width
    : Number(width) !== entry.width || separator !== entry.separator;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['numbering', companyId] });

  const save = useMutation({
    mutationFn: () =>
      setNumbering(
        companyId,
        entry.series,
        isCounted
          ? {
              prefix: prefix.trim(),
              base: Number(base),
              step: Number(step),
              width: Number(width || 0),
            }
          : { width: Number(width), separator },
      ),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void refresh();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Could not save.'),
  });

  const reset = useMutation({
    mutationFn: () => resetNumbering(companyId, entry.series),
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : 'Could not reset.'),
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{entry.label}</h2>
          <p className="text-xs text-gray-500">
            {isCounted
              ? 'Fixed prefix, then the number counted from the start in steps of the gap.'
              : 'Letters from the name, a serial within those letters, then the manufacturing year.'}
          </p>
        </div>
        {entry.isDefault ? (
          <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            Default
          </span>
        ) : (
          <span className="whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            Custom
          </span>
        )}
      </header>

      <FormError message={error} />

      {isCounted ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <TextField
            id={`${entry.series}-prefix`}
            label="Prefix"
            value={prefix}
            onChange={(event) => {
              setPrefix(event.target.value);
              setSaved(false);
            }}
            placeholder="none"
            autoComplete="off"
          />
          <TextField
            id={`${entry.series}-base`}
            label="Start from"
            inputMode="numeric"
            value={base}
            onChange={(event) => {
              setBase(event.target.value);
              setSaved(false);
            }}
          />
          <TextField
            id={`${entry.series}-step`}
            label="Gap"
            inputMode="numeric"
            value={step}
            onChange={(event) => {
              setStep(event.target.value);
              setSaved(false);
            }}
          />
          <TextField
            id={`${entry.series}-width`}
            label="Digits"
            inputMode="numeric"
            value={width}
            onChange={(event) => {
              setWidth(event.target.value);
              setSaved(false);
            }}
            hint="0 = no padding"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            id={`${entry.series}-width`}
            label="Serial digits"
            value={width}
            onChange={(event) => {
              setWidth(event.target.value);
              setSaved(false);
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={String(n)}>
                {n} — {String(1).padStart(n, '0')}
              </option>
            ))}
          </SelectField>
          <SelectField
            id={`${entry.series}-separator`}
            label="Before the year"
            value={separator}
            onChange={(event) => {
              setSeparator(event.target.value);
              setSaved(false);
            }}
          >
            <option value="/">/ (slash)</option>
            <option value="-">- (dash)</option>
            <option value="_">_ (underscore)</option>
            <option value=".">. (dot)</option>
            <option value="">nothing</option>
          </SelectField>
        </div>
      )}

      <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
        <span className="text-xs text-gray-500">Codes look like </span>
        <span className="font-mono text-gray-900">
          {preview.length > 0 ? preview.join(', ') + ' …' : '—'}
        </span>
        {isCounted && entry.nextCode && !changed && (
          <p className="mt-1 text-xs text-gray-600">
            Next one to be given:{' '}
            <span className="font-mono font-semibold text-gray-900">
              {entry.nextCode}
            </span>
          </p>
        )}
        {!isCounted && (
          <p className="mt-1 text-xs text-gray-600">
            The letters come from the name: “JCB 3DX Backhoe” → JCB, “Transit
            Mixer” → TM. The year is the manufacturing year.
          </p>
        )}
      </div>

      {isCounted && changed && (
        <p className="text-xs text-amber-800">
          Saving restarts this series from the new start. Codes already given
          stay as they are, and any already in use are skipped.
        </p>
      )}
      {saved && !changed && (
        <p className="text-xs text-green-700" role="status">
          Saved.
        </p>
      )}

      <div className="mt-auto flex flex-wrap justify-end gap-2">
        {!entry.isDefault && (
          <SecondaryButton
            type="button"
            disabled={reset.isPending}
            onClick={async () => {
              if (
                await confirmDialog({
                  title: `Use the default ${entry.label.toLowerCase()} format?`,
                  message:
                    'The series goes back to the built-in format. Codes already given are not changed.',
                  confirmLabel: 'Use default',
                })
              ) {
                reset.mutate();
              }
            }}
          >
            Use default
          </SecondaryButton>
        )}
        <Button
          type="button"
          disabled={!valid || !changed || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </section>
  );
}
