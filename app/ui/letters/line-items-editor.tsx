'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getBOQ } from '@/app/lib/api/projects';
import { money, rupees, unitRate } from '@/app/lib/format';
import SearchableSelect, {
  type SearchableOption,
} from '@/app/ui/searchable-select';

/**
 * The item table of an LOI, work order or purchase order, entered as rows (2026-10-14).
 *
 * It was a text box taking one item per line — `Description | Unit | Quantity | Rate` — which is
 * the format the server reads and a poor one to type a schedule into. Here the items are picked
 * from the project's BOQ, the way a DWR picks them, and each gets its quantity and rate. What this
 * hands back is still those lines, so the server, the preview and an issued letter read them
 * exactly as before.
 *
 * **The rate starts empty, not at the BOQ's.** The BOQ rate is the client's; a work order or LOI
 * goes to a subcontractor at the rate agreed with them. Prefilled, the client's rate would go out
 * on any line nobody changed. It is shown beside the box instead, for reference.
 */
interface Row {
  key: number;
  boqNo: string;
  description: string;
  unit: string;
  quantity: string;
  rate: string;
  hsn: string;
  /** The client's rate for a BOQ line, shown for reference and never sent. */
  boqRate: number | null;
}

let nextKey = 1;

/** A cell as the server reads it: no pipes (they separate cells), on one line. */
const cell = (value: string) =>
  value
    .replace(/\|/g, '/')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

/** `1,25,000` or `₹ 410` as typed, as a number; NaN when it is not one. */
const numberOf = (value: string) => {
  const cleaned = value.replace(/[₹,\s]/g, '');
  return cleaned === '' ? NaN : Number(cleaned);
};

function serialise(rows: Row[], withHsn: boolean): string {
  return rows
    .map((row) => {
      const description = cell(
        row.boqNo ? `${row.boqNo} - ${row.description}` : row.description,
      );
      const cells = [
        description,
        cell(row.unit),
        cell(row.quantity),
        cell(row.rate),
      ];
      if (withHsn && row.hsn.trim()) cells.push(cell(row.hsn));
      return cells.join(' | ');
    })
    .join('\n');
}

/** Rows back out of lines already typed — a letter reopened, or one composed before this. */
function parse(value: string): Row[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [description = '', unit = '', quantity = '', rate = '', hsn = ''] =
        line.split(/\t|\|/).map((c) => c.trim());
      return {
        key: nextKey++,
        boqNo: '',
        description,
        unit,
        quantity,
        rate,
        hsn,
        boqRate: null,
      };
    });
}

export default function LineItemsEditor({
  projectId,
  value,
  onChange,
  withHsn,
  fromBoq,
}: {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  /** The work order prints an HSN column; the LOI and purchase order do not. */
  withHsn: boolean;
  /** Offer the project's BOQ to pick from. Off for a purchase order, which buys materials. */
  fromBoq: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() => parse(value));

  const boq = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => getBOQ(projectId),
    enabled: fromBoq,
  });
  // The contract schedule only, as the DWR offers it: an internal estimate describes the same work
  // in the same words, and listing both would show every item twice.
  const items = (boq.data ?? [])
    .filter((group) => !group.isEstimate)
    .flatMap((group) => group.items);
  const options: SearchableOption[] = items.map((item) => ({
    id: item.id,
    label: item.boqNo,
    sublabel: item.taskName,
    note: item.unit,
  }));

  const update = (next: Row[]) => {
    setRows(next);
    onChange(serialise(next, withHsn));
  };
  const change = (key: number, patch: Partial<Row>) =>
    update(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addFromBoq = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    update([
      ...rows,
      {
        key: nextKey++,
        boqNo: item.boqNo,
        description: item.taskName,
        unit: item.unit,
        // The scope still to do, which is what is usually being let; editable.
        quantity: Number.isFinite(item.pendingQty)
          ? String(item.pendingQty)
          : String(item.scopeQty),
        rate: '',
        hsn: '',
        boqRate: Number.isFinite(item.rate) ? item.rate : null,
      },
    ]);
  };
  const addOther = () =>
    update([
      ...rows,
      {
        key: nextKey++,
        boqNo: '',
        description: '',
        unit: '',
        quantity: '',
        rate: '',
        hsn: '',
        boqRate: null,
      },
    ]);

  const amountOf = (row: Row) => numberOf(row.quantity) * numberOf(row.rate);
  const total = rows.reduce(
    (sum, row) => sum + (Number.isFinite(amountOf(row)) ? amountOf(row) : 0),
    0,
  );
  const input = 'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm';

  return (
    <div className="space-y-3">
      {fromBoq && (
        <div className="flex flex-col gap-1">
          <SearchableSelect
            value=""
            onChange={addFromBoq}
            options={options}
            placeholder={
              boq.isLoading
                ? 'Reading the BOQ…'
                : 'Add from BOQ — search by item number or description'
            }
            disabled={boq.isLoading || options.length === 0}
          />
          {boq.isSuccess && options.length === 0 && (
            <span className="text-xs text-gray-500">
              This project has no BOQ yet. Add the items below instead.
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-2">Description</th>
                <th className="w-20 py-2 pr-2">Unit</th>
                <th className="w-28 py-2 pr-2">Quantity</th>
                <th className="w-32 py-2 pr-2">Rate</th>
                {withHsn && <th className="w-24 py-2 pr-2">HSN</th>}
                <th className="w-32 py-2 pr-2 text-right">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const amount = amountOf(row);
                return (
                  <tr key={row.key} className="border-b align-top">
                    <td className="py-2 pr-2">
                      {row.boqNo && (
                        <span className="mb-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                          BOQ {row.boqNo}
                        </span>
                      )}
                      <textarea
                        aria-label="Description"
                        rows={2}
                        value={row.description}
                        onChange={(e) =>
                          change(row.key, { description: e.target.value })
                        }
                        className={input}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label="Unit"
                        value={row.unit}
                        onChange={(e) =>
                          change(row.key, { unit: e.target.value })
                        }
                        className={input}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label="Quantity"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(e) =>
                          change(row.key, { quantity: e.target.value })
                        }
                        className={input}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        aria-label="Rate"
                        inputMode="decimal"
                        value={row.rate}
                        placeholder="Agreed rate"
                        onChange={(e) =>
                          change(row.key, { rate: e.target.value })
                        }
                        className={input}
                      />
                      {row.boqRate !== null && (
                        <span className="mt-0.5 block text-xs text-gray-500">
                          BOQ rate {unitRate(row.boqRate)}
                        </span>
                      )}
                    </td>
                    {withHsn && (
                      <td className="py-2 pr-2">
                        <input
                          aria-label="HSN code"
                          value={row.hsn}
                          onChange={(e) =>
                            change(row.key, { hsn: e.target.value })
                          }
                          className={input}
                        />
                      </td>
                    )}
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {Number.isFinite(amount) ? money(amount) : '—'}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        aria-label="Remove item"
                        onClick={() =>
                          update(rows.filter((other) => other.key !== row.key))
                        }
                        className="px-1 text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={withHsn ? 5 : 4}
                  className="py-2 pr-2 text-right text-xs text-gray-500"
                >
                  Before GST — GST and the total are added on the letter
                </td>
                <td className="py-2 pr-2 text-right font-semibold tabular-nums">
                  {rupees(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={addOther}
        className="text-sm font-medium text-blue-700 hover:underline"
      >
        {fromBoq ? '+ Add an item not in the BOQ' : '+ Add item'}
      </button>
    </div>
  );
}
