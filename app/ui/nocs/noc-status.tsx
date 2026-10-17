"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getNocStatuses,
  NOC_STATUS_PAGE,
  type NocStatus,
  type NocSubject,
} from "@/app/lib/api/nocs";
import { dateLabel } from "@/app/lib/format";
import { SelectField } from "@/app/ui/settings/form-fields";
import StatusBadge from "@/app/ui/status-badge";

/**
 * Open / closed by NOC, for any list whose rows take one (2026-10-17): a record is **open** until
 * its NOC is uploaded and **closed** from then on — a work order on its NOC after the work order.
 * A status only; it blocks nothing and sits beside the record's own status.
 */

export type NocFilter = "" | "open" | "closed";

/** Every listed record's NOC status, fetched in pages the server accepts. */
export function useNocStatuses(
  subjectType: NocSubject,
  subjectIds: string[],
): Map<string, NocStatus> | undefined {
  const ids = Array.from(new Set(subjectIds)).sort();
  const query = useQuery({
    // Under `nocs`, so an upload or removal anywhere (which invalidates `['nocs']`) refreshes it.
    queryKey: ["nocs", "status", subjectType, ids],
    queryFn: async () => {
      const pages: Promise<NocStatus[]>[] = [];
      for (let i = 0; i < ids.length; i += NOC_STATUS_PAGE) {
        pages.push(
          getNocStatuses(subjectType, ids.slice(i, i + NOC_STATUS_PAGE)),
        );
      }
      return (await Promise.all(pages)).flat();
    },
    enabled: ids.length > 0,
  });
  if (ids.length === 0) return new Map();
  return query.data
    ? new Map(query.data.map((s) => [s.subjectId, s]))
    : undefined;
}

/**
 * Open or Closed. `labelled` prefixes "NOC" for a place where the badge stands beside the record's
 * own status (a work order's "Active"), so the two are not read as one.
 */
export function NocStatusBadge({
  status,
  labelled = false,
}: {
  status: NocStatus | undefined;
  labelled?: boolean;
}) {
  if (!status) return <span className="text-sm text-gray-500">—</span>;
  const badge =
    status.status === "closed" ? (
      <span
        title={
          status.closedAt
            ? `NOC uploaded ${dateLabel(status.closedAt)}`
            : undefined
        }
      >
        <StatusBadge status="closed" label="Closed" />
      </span>
    ) : (
      <StatusBadge status="open" label="Open" />
    );
  return labelled ? (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      NOC {badge}
    </span>
  ) : (
    badge
  );
}

/** Keeps the rows matching `filter`; everything while statuses are still loading. */
export function filterByNoc<T>(
  rows: T[],
  filter: NocFilter,
  statuses: Map<string, NocStatus> | undefined,
  idOf: (row: T) => string,
): T[] {
  if (!filter || !statuses) return rows;
  return rows.filter(
    (row) => (statuses.get(idOf(row))?.status ?? "open") === filter,
  );
}

export function NocFilterField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: NocFilter;
  onChange: (value: NocFilter) => void;
}) {
  return (
    <SelectField
      id={id}
      label="NOC"
      value={value}
      onChange={(e) => onChange(e.target.value as NocFilter)}
    >
      <option value="">Open and closed</option>
      <option value="open">Open — NOC awaited</option>
      <option value="closed">Closed — NOC uploaded</option>
    </SelectField>
  );
}
