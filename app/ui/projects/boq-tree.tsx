'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { deleteBOQItem, getBOQ, type BoqGroup } from '@/app/lib/api/projects';
import { BOQ_COPY } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { useProjectLock } from '@/app/ui/projects/project-lock-context';
import { RowAction } from '@/app/ui/settings/form-fields';

/**
 * The project's BOQ as the two-level schedule its source actually is (008 FR-025, FR-026).
 *
 * **A section heading is rendered as a heading, not as a line with no quantity.** Showing it in
 * the quantity column is wrong both ways: blank reads as missing data and `0` reads as a real
 * figure, and the row is in fact a title. It spans instead.
 *
 * **Unplanned reads as the word, never as an em dash or a zero.** An imported tender is entirely
 * unplanned on the day it arrives — all 231 lines of the client's own file — so this is the
 * screen's normal state rather than an exception in it. A zero per-day target would claim the work
 * is achieving nothing, which is a different fact from nobody having set a target.
 *
 * The table scrolls inside its own container (FR-032). It is eleven columns wide, so the page body
 * must not be what moves sideways.
 */
export default function BoqTree({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { isLocked } = useProjectLock();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', projectId, 'boq'],
    queryFn: () => getBOQ(projectId),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => deleteBOQItem(projectId, itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
      // The alert tabs read the same lines through a different endpoint, so they go stale with it.
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq-alerts'] });
      setError(null);
    },
    onError: (err: Error) =>
      setError(err instanceof ApiError ? BOQ_COPY.deleteBlocked : err.message),
  });

  const toggle = (groupId: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  if (isLoading) return <p className="text-sm text-gray-500">{BOQ_COPY.loading}</p>;
  if (isError) return <p className="text-sm text-red-700">{BOQ_COPY.loadFailed}</p>;
  if (!data || data.length === 0) {
    return (
      <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">{BOQ_COPY.empty}</p>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-[60rem] w-full text-sm">
          <caption className="sr-only">{BOQ_COPY.heading}</caption>
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnBoqNo}</th>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnTask}</th>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnUnit}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnScope}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.rate}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnDone}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnPending}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnPerDay}</th>
              <th scope="col" className="px-3 py-2 text-right">{BOQ_COPY.columnAvgPerDay}</th>
              <th scope="col" className="px-3 py-2">{BOQ_COPY.columnFinish}</th>
              {!isLocked && <th scope="col" className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {data.map((group) => (
              <GroupRows
                key={group.id}
                group={group}
                collapsed={collapsed.has(group.id)}
                onToggle={() => toggle(group.id)}
                onDelete={isLocked ? null : (itemId) => remove.mutate(itemId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRows({
  group,
  collapsed,
  onToggle,
  onDelete,
}: {
  group: BoqGroup;
  collapsed: boolean;
  onToggle: () => void;
  /** Null when the project is locked: the control is absent, not disabled. */
  onDelete: ((itemId: string) => void) | null;
}) {
  const columns = onDelete ? 11 : 10;

  return (
    <>
      {/* FR-025. A section spans rather than sitting in the quantity column, because it is a
          title: blank there reads as missing data and 0 reads as a real figure. */}
      <tr className="border-t border-gray-200 bg-gray-50">
        <th scope="rowgroup" colSpan={columns} className="px-3 py-2 text-left">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="flex items-center gap-2 font-semibold text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <span aria-hidden="true" className="text-gray-400">
              {collapsed ? '▸' : '▾'}
            </span>
            <span className="text-xs font-normal uppercase tracking-wide text-gray-500">
              {BOQ_COPY.sectionLabel} {group.boqNo}
            </span>
            {group.name}
            <span className="text-xs font-normal text-gray-500">
              ({group.items.length})
            </span>
          </button>
        </th>
      </tr>

      {!collapsed &&
        group.items.map((item) => (
          <tr key={item.id} className="border-t border-gray-100">
            <td className="px-3 py-2 text-gray-500 tabular-nums">{item.boqNo}</td>
            <td className="px-3 py-2 text-gray-900">
              {item.taskName}
              {item.isVariation && (
                <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                  {BOQ_COPY.variation}
                </span>
              )}
            </td>
            {/* FR-030: exactly as the client spelled it. Tidying `R. mtr` to `R.Mtr.` creates a
                difference they cannot trace against their own sheet. */}
            <td className="px-3 py-2 text-gray-700">{item.unit}</td>
            <td className="px-3 py-2 text-right tabular-nums">{item.scopeQty.toFixed(3)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{rupees(item.rate)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{item.doneQty.toFixed(3)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{item.pendingQty.toFixed(3)}</td>
            <Programme value={item.perDayQty} />
            <Programme value={item.avgQtyPerDay} />
            <td className="px-3 py-2">
              {item.finishDate ? (
                new Date(item.finishDate).toLocaleDateString()
              ) : (
                <Unplanned />
              )}
            </td>
            {onDelete && (
              <td className="px-3 py-2">
                <RowAction onClick={() => onDelete(item.id)}>{BOQ_COPY.deleteLine}</RowAction>
              </td>
            )}
          </tr>
        ))}
    </>
  );
}

/** A programme figure, or the word (FR-026). */
function Programme({ value }: { value: number | null }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {value === null ? <Unplanned /> : value.toFixed(3)}
    </td>
  );
}

/**
 * **The word, not an em dash and not a zero.**
 *
 * This is the state of every line of a freshly imported tender, so it is the common case on this
 * screen and must read as ordinary rather than as an error. Styled grey for the same reason the
 * location-assignment panel's empty state is grey: colouring the normal case as a warning is how a
 * screen teaches people to ignore its warnings.
 */
function Unplanned() {
  return <span className="text-xs text-gray-400">{BOQ_COPY.unplanned}</span>;
}
