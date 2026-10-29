"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useState } from "react";

import { errorMessage } from "@/app/lib/api/client";
import { useSelectedCompanyId } from "@/app/lib/api/company-selection";
import {
  getDailyRateBoard,
  getDailyRateHistory,
  setDailyRates,
  type DailyRateBoardItem,
  type DailyRateInput,
} from "@/app/lib/api/inventory";
import { DAILY_RATE_COPY } from "@/app/lib/constants";
import { dateLabel, rupees, todayIso } from "@/app/lib/format";
import { useCanWrite } from "@/app/lib/write-access";
import { Button, TextButton } from "@/app/ui/button";
import PageHeader from "@/app/ui/page-header";
import QueryError from "@/app/ui/query-error";
import { FormError, TextField } from "@/app/ui/settings/form-fields";
import Modal from "@/app/ui/settings/modal";
import { ListSkeleton } from "@/app/ui/skeletons";
import { TABLE } from "@/app/ui/table-classes";
import { useToast } from "@/app/ui/toast";

/** A typed rate, keyed `itemId|vendorId` ('' for the market rate). */
type Drafts = Record<string, string>;
const keyOf = (itemId: string, vendorId: string | null) =>
  `${itemId}|${vendorId ?? ""}`;

/**
 * Update today's rates (050): "there are some items whose rates are changing on a day basis …
 * otherwise we'd have to change the vendor's rate every time".
 *
 * One row per daily-rate item, opened on the rate in force (yesterday's, until today's is saved),
 * so a day's update is one edit per item. Under it, each vendor who has supplied the item: blank
 * follows the market rate, a figure is that vendor's own rate for the day. Saving writes only what
 * changed. Past purchases, POs and fuel entries keep the rate they were recorded at.
 */
export default function DailyRatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const canWrite = useCanWrite();
  const [date, setDate] = useState(todayIso());
  const [drafts, setDrafts] = useState<Drafts>({});
  const [error, setError] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<DailyRateBoardItem | null>(null);

  const board = useQuery({
    queryKey: ["inventory", "daily-rates", companyId, date],
    queryFn: () => getDailyRateBoard(date),
  });

  /** What the field shows before it is touched: the market rate in force, or the vendor's own. */
  const shown = (item: DailyRateBoardItem, vendorId: string | null) => {
    const typed = drafts[keyOf(item.itemId, vendorId)];
    if (typed !== undefined) return typed;
    if (vendorId === null) return item.market ? String(item.market.rate) : "";
    const vendor = item.vendors.find((v) => v.vendorId === vendorId);
    // A vendor's own figure is shown only while it is the one in force; otherwise it follows.
    return vendor?.effective?.source === "vendor"
      ? String(vendor.effective.rate)
      : "";
  };

  /** Only the rows whose figure differs from what is in force, as the API takes them. */
  const changes = (): DailyRateInput[] => {
    const items = board.data?.items ?? [];
    return Object.entries(drafts).flatMap(([key, typed]): DailyRateInput[] => {
      const [itemId, vendor] = key.split("|");
      const vendorId = vendor || null;
      const item = items.find((i) => i.itemId === itemId);
      if (!item) return [];
      const value = typed.trim();
      if (vendorId === null) {
        if (value === "" || Number(value) === item.market?.rate) return [];
        return [{ itemId, vendorId, rate: Number(value) }];
      }
      const current = item.vendors.find((v) => v.vendorId === vendorId);
      const own =
        current?.effective?.source === "vendor" ? current.effective : null;
      if (value === "") {
        // Cleared: drop the vendor's own rate for this day, if it set one today.
        return own && own.effectiveFrom === date
          ? [{ itemId, vendorId, rate: null }]
          : [];
      }
      if (own && Number(value) === own.rate) return [];
      return [{ itemId, vendorId, rate: Number(value) }];
    });
  };

  const save = useMutation({
    mutationFn: (rows: DailyRateInput[]) => setDailyRates(date, rows),
    onSuccess: (next, rows) => {
      queryClient.setQueryData(
        ["inventory", "daily-rates", companyId, date],
        next,
      );
      void queryClient.invalidateQueries({
        queryKey: ["inventory", "daily-rate"],
      });
      setDrafts({});
      toast.success(DAILY_RATE_COPY.saved(rows.length));
    },
    onError: (err) => setError(errorMessage(err, "Could not save the rates.")),
  });

  const invalid = Object.values(drafts).some(
    (v) => v.trim() !== "" && !(Number(v) >= 0),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={DAILY_RATE_COPY.title}
        description={DAILY_RATE_COPY.description}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-48">
          <TextField
            id="daily-rates-date"
            label={DAILY_RATE_COPY.dateLabel}
            type="date"
            max={todayIso()}
            value={date}
            onChange={(event) => {
              setDate(event.target.value || todayIso());
              setDrafts({});
              setError(null);
            }}
          />
        </div>
        {canWrite && (board.data?.items.length ?? 0) > 0 && (
          <Button
            disabled={invalid}
            loading={save.isPending}
            onClick={() => {
              setError(null);
              const rows = changes();
              if (rows.length === 0) {
                toast.success(DAILY_RATE_COPY.nothingChanged);
                return;
              }
              save.mutate(rows);
            }}
          >
            {DAILY_RATE_COPY.save}
          </Button>
        )}
      </div>

      <FormError message={error} />

      {board.isPending ? (
        <ListSkeleton headers={["Item / vendor", "In force", "Rate"]} />
      ) : board.isError ? (
        <QueryError error={board.error} onRetry={board.refetch} />
      ) : board.data.items.length === 0 ? (
        <p className={TABLE.empty}>{DAILY_RATE_COPY.empty}</p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>Item / vendor</th>
                <th className={TABLE.th}>In force</th>
                <th className={clsx(TABLE.th, "w-44")}>
                  Rate for {dateLabel(date)} (₹)
                </th>
                <th className={TABLE.th}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {board.data.items.map((item) => (
                <ItemRows
                  key={item.itemId}
                  item={item}
                  canWrite={canWrite}
                  value={(vendorId) => shown(item, vendorId)}
                  onChange={(vendorId, value) =>
                    setDrafts((d) => ({
                      ...d,
                      [keyOf(item.itemId, vendorId)]: value,
                    }))
                  }
                  onHistory={() => setHistoryOf(item)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historyOf && (
        <HistoryModal item={historyOf} onClose={() => setHistoryOf(null)} />
      )}
    </div>
  );
}

function ItemRows({
  item,
  canWrite,
  value,
  onChange,
  onHistory,
}: {
  item: DailyRateBoardItem;
  canWrite: boolean;
  value: (vendorId: string | null) => string;
  onChange: (vendorId: string | null, value: string) => void;
  onHistory: () => void;
}) {
  const rateInput = (vendorId: string | null, label: string) => (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      aria-label={label}
      disabled={!canWrite}
      placeholder={
        vendorId === null ? undefined : DAILY_RATE_COPY.vendorPlaceholder
      }
      value={value(vendorId)}
      onChange={(event) => onChange(vendorId, event.target.value)}
      className="w-full min-w-[5.5rem] min-h-11 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:bg-gray-50 sm:min-h-0"
    />
  );

  return (
    <>
      <tr className={clsx(TABLE.row, "bg-gray-50/60")}>
        <td className={TABLE.td}>
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500">
            {item.code} · {item.unit}
            {item.machineFuel ? ` · ${DAILY_RATE_COPY.fuelBadge}` : ""} ·{" "}
            {DAILY_RATE_COPY.marketLabel}
          </p>
        </td>
        <td className={TABLE.td}>
          {item.market ? (
            <>
              <span className="tabular-nums">{rupees(item.market.rate)}</span>
              <span className="block text-xs text-gray-500">
                {DAILY_RATE_COPY.lastSet(dateLabel(item.market.effectiveFrom))}
              </span>
            </>
          ) : (
            <span className="text-gray-500">{DAILY_RATE_COPY.neverSet}</span>
          )}
        </td>
        <td className={TABLE.td}>
          {rateInput(null, `${item.name} — ${DAILY_RATE_COPY.marketLabel}`)}
        </td>
        <td className={clsx(TABLE.td, "text-right")}>
          <TextButton onClick={onHistory}>{DAILY_RATE_COPY.history}</TextButton>
        </td>
      </tr>
      {item.vendors.map((vendor) => (
        <tr key={vendor.vendorId} className={TABLE.row}>
          <td className={clsx(TABLE.td, "pl-8")}>{vendor.vendorName}</td>
          <td className={TABLE.td}>
            {vendor.effective ? (
              <>
                <span className="tabular-nums">
                  {rupees(vendor.effective.rate)}
                </span>
                <span className="block text-xs text-gray-500">
                  {vendor.effective.source === "market"
                    ? DAILY_RATE_COPY.followsMarket
                    : DAILY_RATE_COPY.lastSet(
                        dateLabel(vendor.effective.effectiveFrom),
                      )}
                </span>
              </>
            ) : (
              <span className="text-gray-500">{DAILY_RATE_COPY.neverSet}</span>
            )}
          </td>
          <td className={TABLE.td}>
            {rateInput(vendor.vendorId, `${item.name} — ${vendor.vendorName}`)}
          </td>
          <td className={TABLE.td} />
        </tr>
      ))}
    </>
  );
}

function HistoryModal({
  item,
  onClose,
}: {
  item: DailyRateBoardItem;
  onClose: () => void;
}) {
  const history = useQuery({
    queryKey: ["inventory", "daily-rate", "history", item.itemId],
    queryFn: () => getDailyRateHistory(item.itemId),
  });
  return (
    <Modal title={DAILY_RATE_COPY.historyTitle(item.name)} onClose={onClose}>
      {history.isPending ? (
        <ListSkeleton headers={["From", "Rate for", "Rate"]} />
      ) : history.isError ? (
        <QueryError error={history.error} onRetry={history.refetch} />
      ) : history.data.length === 0 ? (
        <p className={TABLE.empty}>{DAILY_RATE_COPY.historyEmpty}</p>
      ) : (
        <div className={TABLE.wrap}>
          <table className={TABLE.table}>
            <thead className={TABLE.thead}>
              <tr>
                <th className={TABLE.th}>From</th>
                <th className={TABLE.th}>Rate for</th>
                <th className={clsx(TABLE.th, TABLE.numeric)}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((row) => (
                <tr key={row.id} className={TABLE.row}>
                  <td className={TABLE.td}>{dateLabel(row.effectiveFrom)}</td>
                  <td className={TABLE.td}>{row.vendorName}</td>
                  <td className={clsx(TABLE.td, TABLE.numeric)}>
                    {rupees(row.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
