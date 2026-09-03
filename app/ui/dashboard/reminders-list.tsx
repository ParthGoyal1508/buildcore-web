'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  getReminders,
  type Reminder,
  type ReminderQuery,
} from '@/app/lib/api/dashboard';
import {
  daysRemainingLabel,
  MESSAGES,
  REMINDER_SEVERITIES,
  REMINDER_SEVERITY_LABELS,
  reminderModuleLabel,
  reminderTypeLabel,
} from '@/app/lib/constants';
import { SelectField } from '@/app/ui/settings/form-fields';
import { RowAction } from '@/app/ui/settings/form-fields';
import SnoozeModal from '@/app/ui/dashboard/snooze-modal';
import StatusBadge from '@/app/ui/status-badge';

/**
 * The Reminders centre (spec US9, FR-024 to FR-029).
 *
 * The single client surface for due-date reminders: features 002, 006 and 012 render
 * from this rather than each evaluating their own (FR-024). It knows nothing about
 * any particular module — every row is whatever the engine returned, labelled through
 * the fallback-tolerant maps in `constants.ts`, so a rule registered by a module
 * built after this component needs no change here.
 *
 * Sorting is the API's, not this component's: the engine already returns overdue
 * first then soonest due (FR-025), and re-sorting client-side would be a second
 * source of truth that silently disagrees the day the rule changes.
 */
export default function RemindersList() {
  const [filters, setFilters] = useState<ReminderQuery>({});
  const [snoozing, setSnoozing] = useState<Reminder | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['reminders', filters],
    queryFn: () => getReminders(filters),
  });

  /**
   * Filter options come from the data, not a hardcoded list.
   *
   * The set of modules and types is open — that is the engine's whole design — so a
   * fixed dropdown would go stale the first time a module registers a rule.
   *
   * Deliberately a SECOND, unfiltered query rather than a reading of `data`. Deriving
   * the options from the filtered response collapses each dropdown to whatever the
   * current filter left standing: pick a module and every other module disappears,
   * so the only move available is back to "All modules" — you can never go sideways.
   * With no filters active the two queries share a key and react-query serves both
   * from one fetch, so the extra request only happens once a filter is on.
   */
  const { data: unfiltered } = useQuery({
    queryKey: ['reminders', {}],
    queryFn: () => getReminders({}),
  });

  const { modules, types } = useMemo(() => {
    const reminders = unfiltered?.reminders ?? [];
    // The active selection is always an option, even when nothing matches it any
    // more — snooze the last reminder in a module and that module leaves the
    // unfiltered list, which would otherwise leave the `select` showing blank
    // against a value it no longer offers.
    const withSelection = (values: string[], selected?: string) =>
      Array.from(new Set(selected ? [...values, selected] : values)).sort();
    return {
      modules: withSelection(
        reminders.map((r) => r.sourceModule),
        filters.module,
      ),
      types: withSelection(reminders.map((r) => r.type), filters.type),
    };
  }, [unfiltered, filters.module, filters.type]);

  const hasFilters = Boolean(filters.module || filters.type || filters.severity);

  if (isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }

  // FR-026 is about an unavailable *source* not failing the screen. A failed request
  // is a different thing and does fail it — but says so plainly rather than showing
  // an empty list, which would read as "nothing is due".
  if (isError || !data) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {MESSAGES.remindersLoadFailed}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters change a query key, so the list refetches in place — no navigation,
          no full-page reload (TA007). */}
      <div className="flex flex-wrap gap-3">
        <SelectField
          id="filter-module"
          label="Module"
          value={filters.module ?? ''}
          onChange={(event) =>
            setFilters((f) => ({ ...f, module: event.target.value || undefined }))
          }
        >
          <option value="">All modules</option>
          {modules.map((module) => (
            <option key={module} value={module}>
              {reminderModuleLabel(module)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="filter-type"
          label="Type"
          value={filters.type ?? ''}
          onChange={(event) =>
            setFilters((f) => ({ ...f, type: event.target.value || undefined }))
          }
        >
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {reminderTypeLabel(type)}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="filter-severity"
          label="Severity"
          value={filters.severity ?? ''}
          onChange={(event) =>
            setFilters((f) => ({
              ...f,
              severity: event.target.value || undefined,
            }))
          }
        >
          <option value="">All severities</option>
          {REMINDER_SEVERITIES.map((severity) => (
            <option key={severity} value={severity}>
              {REMINDER_SEVERITY_LABELS[severity]}
            </option>
          ))}
        </SelectField>
      </div>

      {/* FR-026: a source whose module is not built is reported, and the rest of the
          screen carries on. Stated as a note rather than a warning — nothing is
          wrong, there is simply a known blind spot, and the user should know its
          shape rather than believe the list is complete. */}
      {data.unavailable.length > 0 && (
        <p
          className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600"
          role="note"
        >
          {MESSAGES.remindersUnavailable(
            Array.from(
              new Set(data.unavailable.map((u) => reminderModuleLabel(u.sourceModule))),
            ).join(', '),
          )}
        </p>
      )}

      {data.reminders.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          {hasFilters ? MESSAGES.remindersEmptyFiltered : MESSAGES.remindersEmpty}
        </p>
      ) : (
        // Desktop-first per constitution v2.0.0: a dense grid read at a desk. It
        // scrolls inside its own container rather than pushing the page sideways.
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Subject</th>
                <th scope="col" className="px-3 py-2 font-medium">Module</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Due</th>
                <th scope="col" className="px-3 py-2 font-medium">Remaining</th>
                <th scope="col" className="px-3 py-2 font-medium">Severity</th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.reminders.map((reminder) => (
                <tr key={reminder.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    {/* FR-028: the row opens the underlying record. A link only when
                        the engine gave one — a module still being built has no screen
                        to open, and a link to nowhere is worse than plain text. */}
                    {reminder.actionLink ? (
                      <Link
                        href={reminder.actionLink}
                        className="font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                      >
                        {reminder.subject}
                      </Link>
                    ) : (
                      <span
                        className="font-medium text-gray-900"
                        title={MESSAGES.reminderNoDestination}
                      >
                        {reminder.subject}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {reminderModuleLabel(reminder.sourceModule)}
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    {reminderTypeLabel(reminder.type)}
                  </td>
                  <td className="px-3 py-3 text-gray-600">{reminder.dueDate}</td>
                  <td className="px-3 py-3 text-gray-600">
                    {daysRemainingLabel(reminder.daysRemaining)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge
                      status={reminder.severity}
                      label={REMINDER_SEVERITY_LABELS[reminder.severity]}
                    />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <RowAction onClick={() => setSnoozing(reminder)}>
                      Snooze
                    </RowAction>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {snoozing && (
        <SnoozeModal
          reminder={snoozing}
          onClose={() => setSnoozing(null)}
        />
      )}
    </div>
  );
}
