'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { getItems } from '@/app/lib/api/inventory';
import { getBOQ } from '@/app/lib/api/projects';
import { money, rupees, unitRate } from '@/app/lib/format';
import SearchableSelect, {
  type SearchableOption,
} from '@/app/ui/searchable-select';
import { TABLE } from '@/app/ui/table';

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
 *
 * **Or from the item master (2026-10-15).** A purchase order buys materials for the company, not a
 * project's work, so it has no BOQ to pick from: its rows come from Inventory's item master —
 * the item's name and code, its unit and HSN — with the quantity and the vendor's rate typed.
 */
export type LineItemsSource = 'boq' | 'items' | 'none';

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
  source,
}: {
  /** The project whose BOQ is offered. Needed only for `source: 'boq'`. */
  projectId?: string;
  value: string;
  onChange: (value: string) => void;
  /** The work order prints an HSN column; the LOI and purchase order do not. */
  withHsn: boolean;
  /**
   * What rows are picked from: the project's BOQ (an LOI or work order), Inventory's item master
   * (a purchase order), or nothing — every row typed.
   */
  source: LineItemsSource;
}) {
  const [rows, setRows] = useState<Row[]>(() => parse(value));
  const fromBoq = source === 'boq' && Boolean(projectId);
  const fromItems = source === 'items';

  const boq = useQuery({
    queryKey: ['boq', projectId],
    queryFn: () => getBOQ(projectId ?? ''),
    enabled: fromBoq,
  });
  // Active items only, as every inventory form offers them — and under the same key, so the cache
  // the purchase and indent forms filled is the one read here.
  const master = useQuery({
    queryKey: ['inventory', 'items', { active: true }],
    queryFn: () => getItems({ active: true, pageSize: 200 }),
    select: (page) => page.items,
    enabled: fromItems,
  });
  const itemOptions: SearchableOption[] = (master.data ?? []).map((item) => ({
    id: item.id,
    label: item.name,
    sublabel: item.code,
    note: item.unit,
  }));
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
  const addFromMaster = (id: string) => {
    const item = (master.data ?? []).find((candidate) => candidate.id === id);
    if (!item) return;
    update([
      ...rows,
      {
        key: nextKey++,
        boqNo: '',
        // The code with the name, as the client's PO prints "Material No. / Description".
        description: `${item.code} - ${item.name}`,
        unit: item.unit,
        quantity: '',
        rate: '',
        hsn: item.hsnCode ?? '',
        boqRate: null,
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
  // The shared cell, top-aligned: a description box is taller than the inputs beside it, and the
  // BOQ-rate hint sits under the rate. `!` because clsx does not drop TABLE.td's align-middle
  // (2026-10-15).
  const cell = clsx(TABLE.td, '!align-top');

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

      {fromItems && (
        <div className="flex flex-col gap-1">
          <SearchableSelect
            value=""
            onChange={addFromMaster}
            options={itemOptions}
            placeholder={
              master.isLoading
                ? 'Reading the item master…'
                : 'Add from the item master — search by name or code'
            }
            disabled={master.isLoading || itemOptions.length === 0}
          />
          {master.isSuccess && itemOptions.length === 0 && (
            <span className="text-xs text-gray-500">
              The item master has no active items. Add the items below instead.
            </span>
          )}
          {master.isError && (
            <span className="text-xs text-gray-500">
              The item master could not be read. Add the items below instead.
            </span>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Description</th>
                <th className={clsx(TABLE.th, 'w-20')}>Unit</th>
                <th className={clsx(TABLE.th, 'w-28')}>Quantity</th>
                <th className={clsx(TABLE.th, 'w-32')}>Rate</th>
                {withHsn && <th className={clsx(TABLE.th, 'w-24')}>HSN</th>}
                <th className={clsx(TABLE.th, TABLE.numeric, 'w-32')}>
                  Amount
                </th>
                <th className={clsx(TABLE.th, 'w-8')} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const amount = amountOf(row);
                return (
                  <tr key={row.key} className={TABLE.row}>
                    <td className={cell}>
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
                    <td className={cell}>
                      <input
                        aria-label="Unit"
                        value={row.unit}
                        onChange={(e) =>
                          change(row.key, { unit: e.target.value })
                        }
                        className={input}
                      />
                    </td>
                    <td className={cell}>
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
                    <td className={cell}>
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
                      <td className={cell}>
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
                    <td className={clsx(cell, TABLE.numeric)}>
                      {Number.isFinite(amount) ? money(amount) : '—'}
                    </td>
                    <td className={cell}>
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
            <tfoot className={TABLE.tfoot}>
              <tr>
                <td
                  colSpan={withHsn ? 5 : 4}
                  className={clsx(
                    TABLE.td,
                    'text-right text-xs font-normal text-gray-500',
                  )}
                >
                  Before GST — GST and the total are added on the letter
                </td>
                <td className={clsx(TABLE.td, TABLE.numeric)}>
                  {rupees(total)}
                </td>
                <td className={TABLE.td} />
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
        {fromBoq
          ? '+ Add an item not in the BOQ'
          : fromItems
            ? '+ Add an item not in the master'
            : '+ Add item'}
      </button>
    </div>
  );
}
