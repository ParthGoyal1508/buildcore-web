'use client';

import clsx from 'clsx';
import { useState } from 'react';

import {
  type BillPackage,
  type DeductionSection,
  setDeductionLines,
} from '@/app/lib/api/bill-packages';
import { Button } from '@/app/ui/button';
import { SecondaryButton } from '@/app/ui/settings/form-fields';
import { describe } from '@/app/ui/projects/bill-lifecycle';
import { TABLE } from '@/app/ui/table';

type Line = { section: DeductionSection; label: string; amount: string };

/** Common ones, offered so nobody types "Camp rent" five ways across five bills. */
const SUGGESTIONS = [
  'Recovery of diesel',
  'Camp / accommodation rent',
  'Material issued',
  'Machinery hire',
  'Electricity & water',
  'Penalty — delay',
  'Penalty — quality / safety',
  'Labour cess',
];

/**
 * A subcontractor bill's own recovery and deduction lines (2026-10-13).
 *
 * The fixed rows above (diesel, civil, theft…) are one contractor's sheet. Every other contractor
 * names their own, so a bill can carry any number of lines: **recoveries** print in block B and
 * **deductions** in block C. Each line's running total is carried to the next bill by its
 * description, which is why two lines with one description are refused.
 *
 * Saved as a whole list — the editor holds it, and a list sent whole cannot half-apply.
 */
export default function BillDeductionLines({
  pkg,
  onSaved,
  onError,
}: {
  pkg: BillPackage;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const initial = (pkg.deductionLines ?? []).map((line) => ({
    section: line.section,
    label: line.label,
    amount: line.amount,
  }));
  const [lines, setLines] = useState<Line[]>(initial);
  const [saving, setSaving] = useState(false);
  // The parent keys this component by the server's lines, so a save or a withdraw back to draft
  // remounts it with the new copy rather than syncing state in an effect.
  const dirty = JSON.stringify(lines) !== JSON.stringify(initial);
  const update = (index: number, patch: Partial<Line>) =>
    setLines(
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );

  const save = async () => {
    setSaving(true);
    try {
      await setDeductionLines(
        pkg.id,
        lines
          .filter((line) => line.label.trim() || Number(line.amount))
          .map((line) => ({
            section: line.section,
            label: line.label.trim(),
            amount: line.amount.trim() || '0',
          })),
      );
      onSaved();
    } catch (err) {
      onError(describe(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h3 className="font-medium text-gray-900">
          Other recoveries and deductions
        </h3>
        <p className="text-sm text-gray-600">
          Add any line this subcontractor’s bill needs. Recoveries print under{' '}
          <strong>B. Recoveries</strong>, deductions under{' '}
          <strong>C. Deductions</strong>; both come off the payable. A line’s
          running total carries to the next bill by its description.
        </p>
      </header>

      {lines.length > 0 && (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Type</th>
                <th className={TABLE.th}>Description</th>
                <th className={clsx(TABLE.th, 'text-right')}>
                  Amount this bill (₹)
                </th>
                <th className={TABLE.th} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className={TABLE.row}>
                  <td className={TABLE.td}>
                    <label className="sr-only" htmlFor={`ded-section-${index}`}>
                      Type
                    </label>
                    <select
                      id={`ded-section-${index}`}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      value={line.section}
                      onChange={(e) =>
                        update(index, {
                          section: e.target.value as DeductionSection,
                        })
                      }
                    >
                      <option value="recovery">Recovery (B)</option>
                      <option value="deduction">Deduction (C)</option>
                    </select>
                  </td>
                  <td className={TABLE.td}>
                    <label className="sr-only" htmlFor={`ded-label-${index}`}>
                      Description
                    </label>
                    <input
                      id={`ded-label-${index}`}
                      list="deduction-suggestions"
                      className="w-full min-w-[14rem] rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      value={line.label}
                      maxLength={200}
                      onChange={(e) => update(index, { label: e.target.value })}
                    />
                  </td>
                  <td className={TABLE.td}>
                    <label className="sr-only" htmlFor={`ded-amount-${index}`}>
                      Amount
                    </label>
                    <input
                      id={`ded-amount-${index}`}
                      inputMode="decimal"
                      className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                      value={line.amount}
                      onChange={(e) =>
                        update(index, { amount: e.target.value })
                      }
                    />
                  </td>
                  <td className={TABLE.td}>
                    <button
                      type="button"
                      className="text-xs font-medium text-red-700 underline"
                      onClick={() =>
                        setLines(lines.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="deduction-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <SecondaryButton
          type="button"
          onClick={() =>
            setLines([...lines, { section: 'recovery', label: '', amount: '' }])
          }
        >
          Add a line
        </SecondaryButton>
        {dirty && (
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save lines'}
          </Button>
        )}
      </div>
    </section>
  );
}
