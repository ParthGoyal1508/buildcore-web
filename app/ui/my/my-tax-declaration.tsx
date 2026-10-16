'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getMyDeclaration,
  saveMyDeclaration,
  TAX_REGIMES,
  type MyDeclaration,
} from '@/app/lib/api/my-workspace';
import { financialYearOf, money } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/** The sections employees most often declare; any other section code can be typed. */
const COMMON_SECTIONS = ['80C', '80D', '80CCD(1B)', '24(b)', '80E', 'HRA'];

interface Line {
  sectionCode: string;
  declaredAmount: string;
}

/** This financial year and the next, for declaring ahead in March. */
function yearChoices(): string[] {
  const now = financialYearOf();
  const start = Number(now.slice(0, 4));
  const next = `${start + 1}-${String((start + 2) % 100).padStart(2, '0')}`;
  return [now, next];
}

/**
 * The employee's own investment declaration for TDS (2026-10-16, My Workspace).
 *
 * Payroll's TDS screen used to be the only way in, so every declaration was keyed in by someone
 * else. The employee picks the regime and lists their sections; the server caps each line at its
 * ceiling and the capped figure is shown beside the declared one. Once payroll has verified any
 * line against proof, the declaration is read-only here and changes go through payroll.
 */
export default function MyTaxDeclaration() {
  const [financialYear, setFinancialYear] = useState(() => financialYearOf());
  const { data, isPending, isError } = useQuery({
    queryKey: ['my', 'tds', financialYear],
    queryFn: () => getMyDeclaration(financialYear),
  });

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <SelectField
          id="tax-year"
          label="Financial year"
          value={financialYear}
          onChange={(event) => setFinancialYear(event.target.value)}
        >
          {yearChoices().map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>
      </div>
      {isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : isError ? (
        <p className="text-sm text-red-700" role="alert">
          Could not load your declaration.
        </p>
      ) : (
        <DeclarationForm
          key={`${financialYear}-${data?.id ?? 'new'}`}
          financialYear={financialYear}
          existing={data}
        />
      )}
    </div>
  );
}

function DeclarationForm({
  financialYear,
  existing,
}: {
  financialYear: string;
  existing: MyDeclaration | null;
}) {
  const queryClient = useQueryClient();
  const locked = (existing?.lines ?? []).some(
    (line) => line.status === 'verified',
  );
  const [regime, setRegime] = useState<(typeof TAX_REGIMES)[number]>(
    existing?.regime ?? 'new',
  );
  const [lines, setLines] = useState<Line[]>(() =>
    existing && existing.lines.length > 0
      ? existing.lines.map((line) => ({
          sectionCode: line.sectionCode,
          declaredAmount: String(line.declaredAmount),
        }))
      : [{ sectionCode: '80C', declaredAmount: '' }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      saveMyDeclaration({
        financialYear,
        regime,
        lines: lines
          .filter((line) => line.sectionCode.trim() && line.declaredAmount)
          .map((line) => ({
            sectionCode: line.sectionCode.trim(),
            declaredAmount: Number(line.declaredAmount),
          })),
      }),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['my', 'tds'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not save your declaration.',
      ),
  });

  const capped = new Map(
    (existing?.lines ?? []).map((line) => [line.sectionCode, line]),
  );
  const setLine = (index: number, patch: Partial<Line>) => {
    setSaved(false);
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  return (
    <form
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {locked && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Payroll has verified part of this declaration against your proofs, so
          it can no longer be changed here. Ask payroll to revise it.
        </p>
      )}
      <div className="max-w-xs">
        <SelectField
          id="tax-regime"
          label="Tax regime"
          value={regime}
          disabled={locked}
          onChange={(event) => {
            setSaved(false);
            setRegime(event.target.value as (typeof TAX_REGIMES)[number]);
          }}
          hint="Most deductions apply under the old regime only."
        >
          <option value="new">New regime</option>
          <option value="old">Old regime</option>
        </SelectField>
      </div>

      <datalist id="tax-sections">
        {COMMON_SECTIONS.map((code) => (
          <option key={code} value={code} />
        ))}
      </datalist>
      <div className="space-y-3">
        {lines.map((line, index) => {
          const onFile = capped.get(line.sectionCode.trim().toUpperCase());
          return (
            <div
              key={index}
              className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
            >
              <TextField
                id={`tax-section-${index}`}
                label="Section"
                list="tax-sections"
                value={line.sectionCode}
                disabled={locked}
                onChange={(event) =>
                  setLine(index, { sectionCode: event.target.value })
                }
              />
              <TextField
                id={`tax-amount-${index}`}
                label="Amount (₹)"
                type="number"
                min={0}
                inputMode="decimal"
                value={line.declaredAmount}
                disabled={locked}
                hint={
                  onFile && onFile.cappedAmount < onFile.declaredAmount
                    ? `Capped at ${money(onFile.cappedAmount)}`
                    : onFile?.status === 'verified'
                      ? 'Verified'
                      : undefined
                }
                onChange={(event) =>
                  setLine(index, { declaredAmount: event.target.value })
                }
              />
              {!locked && lines.length > 1 && (
                <RowAction
                  onClick={() =>
                    setLines((current) => current.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </RowAction>
              )}
            </div>
          );
        })}
      </div>

      <FormError message={error} />
      {saved && (
        <p className="text-sm text-green-700" role="status">
          Declaration saved.
        </p>
      )}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            onClick={() =>
              setLines((current) => [
                ...current,
                { sectionCode: '', declaredAmount: '' },
              ])
            }
          >
            Add a section
          </SecondaryButton>
          <Button type="submit" disabled={save.isPending}>
            {existing ? 'Update declaration' : 'Submit declaration'}
          </Button>
        </div>
      )}
    </form>
  );
}
