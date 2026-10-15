'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadLogbookSheet,
  getLogbookSheet,
  saveLogbookSheet,
  type LogbookSheet as Sheet,
  type LogbookSheetRowInput,
} from '@/app/lib/api/plant';
import { saveBlob } from '@/app/lib/download-file';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `2026-08-01` as the client's sheet writes it: `1-Aug-26`. */
function sheetDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)}-${MONTHS[Number(month) - 1]}-${year.slice(2)}`;
}

function figure(value: number | null, digits = 0): string {
  return value === null
    ? ''
    : value.toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: 2,
      });
}

/** A day as typed; every field a string so a half-typed number survives a re-render. */
interface Draft {
  cardNo?: string;
  dieselAmount?: string;
  dieselQuantity?: string;
  openingReading?: string;
  closingReading?: string;
}

/** A meter reading as the meter shows it — `337560`, not `3,37,560`. */
function reading(value: number | null): string {
  return value === null
    ? ''
    : value.toLocaleString('en-IN', {
        useGrouping: false,
        maximumFractionDigits: 3,
      });
}

const num = (value: string | undefined) =>
  value === undefined || value.trim() === '' ? null : Number(value);
const isDirty = (draft: Draft | undefined) =>
  !!draft && Object.values(draft).some((value) => value?.trim());

type SheetRowData = ReturnType<typeof sheetRows>[number];

/**
 * One pass in date order: each day's effective figures, saved or typed, and the starting
 * reading an empty day would inherit from the closing before it.
 */
function sheetRows(data: Sheet, drafts: Record<string, Draft>) {
  let lastClosing = data.carriedReading;
  return data.days.map((day) => {
    const draft = drafts[day.date];
    const readOnly = day.logbookEntryId !== null;
    // A day already read is locked whole, diesel included, as on the paper sheet.
    const dieselLocked =
      readOnly || day.dieselAmount !== null || day.dieselQuantity !== null;
    const defaultOpening = lastClosing;
    const opening = readOnly
      ? day.openingReading
      : (num(draft?.openingReading) ??
        (num(draft?.closingReading) !== null ? defaultOpening : null));
    const closing = readOnly ? day.closingReading : num(draft?.closingReading);
    const total =
      readOnly || opening === null || closing === null
        ? day.total
        : Math.round((closing - opening) * 1000) / 1000;
    if (closing !== null) lastClosing = closing;
    return {
      day,
      draft,
      readOnly,
      dieselLocked,
      defaultOpening,
      opening,
      closing,
      total,
      amount: dieselLocked ? day.dieselAmount : num(draft?.dieselAmount),
      litres: dieselLocked ? day.dieselQuantity : num(draft?.dieselQuantity),
    };
  });
}

const STICKY = 'sticky left-0 z-[1] sm:static';
const CELL = 'border border-gray-200 px-2 py-1.5';
const INPUT =
  'block w-full min-w-0 rounded border border-gray-300 bg-white px-1.5 py-1 text-right text-sm text-gray-900 placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500';

/**
 * The client's "Vehicle Log Book and Diesel Report Sheet" for one machine and month
 * (2026-10-15), entered and read in its own layout.
 *
 * A day that already has readings is shown, not edited: it is a logbook entry by then, and
 * changing it belongs on the entries list where it can be deleted and re-entered. An empty day
 * takes its readings and diesel here; its starting reading follows the previous day's closing
 * (or the reading carried in from last month) because that is what a meter does, but it stays
 * editable for the day the meter was changed. Only the days somebody typed into are sent.
 */
export default function LogbookSheet({
  equipmentId,
  month,
}: {
  equipmentId: string;
  month: string;
}) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);

  const queryKey = ['plant', 'logbook', 'sheet', equipmentId, month];
  const sheet = useQuery({
    queryKey,
    queryFn: () => getLogbookSheet(equipmentId, month),
  });

  const save = useMutation({
    mutationFn: (rows: LogbookSheetRowInput[]) =>
      saveLogbookSheet({ equipmentId, month, rows }),
    onSuccess: (fresh, rows) => {
      queryClient.setQueryData(queryKey, fresh);
      // The entries list, the fuel list and the machine's reading all moved.
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      setDrafts({});
      setNotice(`Saved ${rows.length} ${rows.length === 1 ? 'day' : 'days'}.`);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed,
      ),
  });

  if (sheet.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (sheet.isError) {
    return (
      <FormError
        message={
          sheet.error instanceof ApiError
            ? sheet.error.message
            : MESSAGES.plantLoadFailed
        }
      />
    );
  }

  const data: Sheet = sheet.data;
  const isKm = data.equipment.meterType === 'km';

  function setDraft(date: string, patch: Partial<Draft>) {
    setNotice(null);
    setDrafts((current) => ({
      ...current,
      [date]: { ...current[date], ...patch },
    }));
  }

  const rows = sheetRows(data, drafts);

  // Live totals across saved and typed days; with nothing typed they are the server's own.
  const sum = (values: (number | null)[]) =>
    Math.round(values.reduce<number>((acc, v) => acc + (v ?? 0), 0) * 100) /
    100;
  const totalAmount = sum(rows.map((row) => row.amount));
  const totalLitres = sum(rows.map((row) => row.litres));
  const totalRun = sum(rows.map((row) => row.total));
  const dirtyCount = Object.values(drafts).filter(isDirty).length;
  // The server's own figure until something is typed, so the screen and the download agree.
  const average =
    dirtyCount === 0
      ? data.average
      : totalLitres > 0 && totalRun > 0
        ? isKm
          ? totalRun / totalLitres
          : totalLitres / totalRun
        : null;

  function submit() {
    setError(null);
    setNotice(null);
    const payload: LogbookSheetRowInput[] = [];
    for (const row of rows) {
      if (!isDirty(row.draft)) continue;
      const draft = row.draft!;
      const item: LogbookSheetRowInput = { date: row.day.date };
      if (
        !row.readOnly &&
        (row.closing !== null || num(draft.openingReading) !== null)
      ) {
        if (row.opening === null || row.closing === null) {
          setError(
            `${sheetDate(row.day.date)}: enter both the starting and the closing reading.`,
          );
          return;
        }
        item.openingReading = row.opening;
        item.closingReading = row.closing;
      }
      if (!row.dieselLocked) {
        const amount = num(draft.dieselAmount);
        const litres = num(draft.dieselQuantity);
        if ((amount === null) !== (litres === null)) {
          setError(
            `${sheetDate(row.day.date)}: diesel needs both the advance and the litres.`,
          );
          return;
        }
        if (amount !== null && litres !== null) {
          item.dieselAmount = amount;
          item.dieselQuantity = litres;
          if (draft.cardNo?.trim()) item.cardNo = draft.cardNo.trim();
        }
      }
      if (Object.keys(item).length > 1) payload.push(item);
    }
    if (payload.length === 0) {
      setError('Nothing to save — fill in a day first.');
      return;
    }
    save.mutate(payload);
  }

  async function download(format: 'pdf' | 'xlsx') {
    setDownloading(format);
    setError(null);
    try {
      const { blob, filename } = await downloadLogbookSheet(
        equipmentId,
        month,
        format,
      );
      saveBlob(blob, filename);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not download the sheet.',
      );
    } finally {
      setDownloading(null);
    }
  }

  const unit = isKm ? 'km' : 'hrs';

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Monthly Status of Vehicle No.-
            <span className="whitespace-nowrap">
              {data.equipment.registrationNo ?? data.equipment.code}
            </span>{' '}
            ( {data.equipment.name} )
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {data.equipment.code} · readings in {unit}
            {data.carriedReading !== null &&
              ` · carried in at ${reading(data.carriedReading)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            disabled={downloading !== null}
            onClick={() => void download('pdf')}
          >
            {downloading === 'pdf' ? 'PDF…' : 'PDF'}
          </SecondaryButton>
          <SecondaryButton
            type="button"
            disabled={downloading !== null}
            onClick={() => void download('xlsx')}
          >
            {downloading === 'xlsx' ? 'Excel…' : 'Excel'}
          </SecondaryButton>
        </div>
      </div>

      <FormError message={error} />
      {notice && (
        <p
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {notice}
        </p>
      )}

      {/* Scrolls inside its card on a phone, so the page itself never does. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-700">
            <tr>
              <th className={clsx(CELL, 'w-12')}>Sr. No.</th>
              {/* The date stays in view while a phone scrolls the grid sideways. */}
              <th className={clsx(CELL, STICKY, 'w-24 bg-gray-50')}>Date</th>
              <th className={clsx(CELL, 'min-w-[11rem]')}>Card no.</th>
              <th className={CELL}>Diesel Advance (₹)</th>
              <th className={CELL}>Diesel Quantity (L)</th>
              <th className={CELL}>Starting Reading</th>
              <th className={CELL}>Closing Reading</th>
              <th className={clsx(CELL, 'w-20')}>Total</th>
              <th className={clsx(CELL, 'w-24')}>
                Average ({data.averageUnit})
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <SheetRow
                key={row.day.date}
                index={index}
                row={row}
                averageCell={
                  index === 0 ? (
                    // One figure for the month, merged down the column as on the paper sheet.
                    <td
                      rowSpan={rows.length}
                      className={clsx(
                        CELL,
                        'bg-gray-50 text-center align-middle font-semibold text-gray-900',
                      )}
                    >
                      {average === null ? '—' : average.toFixed(2)}
                      <span className="block text-xs font-normal text-gray-500">
                        {data.averageUnit}
                      </span>
                    </td>
                  ) : null
                }
                onChange={(patch) => setDraft(row.day.date, patch)}
              />
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold text-gray-900">
            <tr>
              <td colSpan={3} className={clsx(CELL, 'text-right')}>
                Total Diesel
              </td>
              <td className={clsx(CELL, 'text-right')}>
                {figure(totalAmount)}
              </td>
              <td className={clsx(CELL, 'text-right')}>
                {figure(totalLitres, 2)}
              </td>
              <td colSpan={2} className={clsx(CELL, 'text-right')}>
                Total run
              </td>
              <td className={clsx(CELL, 'text-right')}>{figure(totalRun)}</td>
              <td className={clsx(CELL, 'text-center')}>
                {average === null
                  ? '—'
                  : `${average.toFixed(2)} ${data.averageUnit}`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-gray-500 sm:mr-auto">
          Days already read are locked; correct them from the daily entries. A
          day&apos;s starting reading follows the closing before it.
        </p>
        {dirtyCount > 0 && (
          <SecondaryButton
            type="button"
            onClick={() => {
              setDrafts({});
              setError(null);
            }}
          >
            Discard
          </SecondaryButton>
        )}
        <Button
          type="button"
          onClick={submit}
          disabled={save.isPending || dirtyCount === 0}
        >
          {save.isPending
            ? 'Saving…'
            : dirtyCount > 0
              ? `Save ${dirtyCount} ${dirtyCount === 1 ? 'day' : 'days'}`
              : 'Save'}
        </Button>
      </div>
    </section>
  );
}

function SheetRow({
  index,
  row,
  averageCell,
  onChange,
}: {
  index: number;
  row: SheetRowData;
  averageCell: React.ReactNode;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const { day, draft, readOnly, dieselLocked } = row;
  const label = sheetDate(day.date);
  const typed = isDirty(draft);
  const number = (
    field: keyof Draft,
    name: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      aria-label={`${name}, ${label}`}
      className={INPUT}
      value={draft?.[field] ?? ''}
      onChange={(event) => onChange({ [field]: event.target.value })}
      {...extra}
    />
  );
  const negative = row.total !== null && row.total < 0;

  return (
    <tr className={clsx(typed && 'bg-amber-50/60')}>
      <td className={clsx(CELL, 'text-center text-gray-500')}>{index + 1}</td>
      <td
        className={clsx(
          CELL,
          STICKY,
          'whitespace-nowrap',
          typed ? 'bg-amber-50' : 'bg-white',
        )}
      >
        {label}
      </td>
      <td className={CELL}>
        {dieselLocked ? (
          <span className="font-mono text-xs">{day.cardNo ?? ''}</span>
        ) : (
          <input
            type="text"
            aria-label={`Card no., ${label}`}
            maxLength={40}
            className={clsx(INPUT, 'text-left font-mono text-xs')}
            value={draft?.cardNo ?? ''}
            onChange={(event) => onChange({ cardNo: event.target.value })}
          />
        )}
      </td>
      <td className={clsx(CELL, 'text-right')}>
        {dieselLocked
          ? figure(day.dieselAmount)
          : number('dieselAmount', 'Diesel advance')}
      </td>
      <td className={clsx(CELL, 'text-right')}>
        {dieselLocked
          ? figure(day.dieselQuantity, 2)
          : number('dieselQuantity', 'Diesel litres')}
      </td>
      <td className={clsx(CELL, 'text-right')}>
        {readOnly
          ? reading(day.openingReading)
          : number('openingReading', 'Starting reading', {
              // The inherited reading is the value once the day is being filled in, and a
              // hint before then, so untouched days do not read as entered.
              value:
                draft?.openingReading ??
                (typed && row.defaultOpening !== null
                  ? String(row.defaultOpening)
                  : ''),
              placeholder:
                row.defaultOpening === null ? '' : String(row.defaultOpening),
            })}
      </td>
      <td className={clsx(CELL, 'text-right')}>
        {readOnly
          ? reading(day.closingReading)
          : number('closingReading', 'Closing reading')}
      </td>
      <td
        className={clsx(
          CELL,
          'text-right tabular-nums',
          negative && 'text-red-700',
          !readOnly && row.total !== null && 'font-medium',
        )}
      >
        {figure(row.total)}
      </td>
      {averageCell}
    </tr>
  );
}
