'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { createHoliday, listHolidays, listSites, type Holiday } from '@/app/lib/api/hr-payroll';
import { HOLIDAY_TYPES, MESSAGES, hrLabel } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import {
  CheckboxField,
  FormError,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/**
 * Declared holidays (005 US3, scenario 5).
 *
 * A holiday is company-wide by default and site-scoped by exception, which is the
 * way the backend models it too — a national holiday applies everywhere, and only
 * a regional or company one usually needs a site list.
 */
export default function HolidaysPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<(typeof HOLIDAY_TYPES)[number]>('company');
  const [allSites, setAllSites] = useState(true);
  const [siteIds, setSiteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'holidays'],
    queryFn: () => listHolidays(),
  });

  const create = useMutation({
    mutationFn: () =>
      createHoliday({
        name: name.trim(),
        date,
        type,
        appliesToAllSites: allSites,
        siteIds: allSites ? undefined : siteIds,
      }),
    onSuccess: () => {
      setName('');
      setDate('');
      setSiteIds([]);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'holidays'] });
      // A new holiday changes what the attendance sheet shows for that date.
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<Holiday>[] = [
    { key: 'date', header: 'Date', sticky: true, render: (row) => dateLabel(row.date) },
    { key: 'name', header: 'Holiday', render: (row) => row.name },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (row.type ? hrLabel(row.type) : '—'),
    },
    {
      key: 'scope',
      header: 'Applies to',
      render: (row) => (row.appliesToAllSites === false ? 'Selected sites' : 'All sites'),
    },
  ];

  const canSubmit = name.trim().length > 0 && date.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) create.mutate();
        }}
        className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4"
      >
        <h3 className="text-sm font-medium text-gray-900">Declare a holiday</h3>
        <FormError message={error} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            id="holiday-name"
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <TextField
            id="holiday-date"
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
          <SelectField
            id="holiday-type"
            label="Type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as (typeof HOLIDAY_TYPES)[number])
            }
          >
            {HOLIDAY_TYPES.map((value) => (
              <option key={value} value={value}>
                {hrLabel(value)}
              </option>
            ))}
          </SelectField>
        </div>
        <CheckboxField
          id="holiday-all-sites"
          label="Applies to every site"
          checked={allSites}
          onChange={(event) => setAllSites(event.target.checked)}
        />
        {!allSites && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-700">Sites</legend>
            {sites?.map((site) => (
              <CheckboxField
                key={site.id}
                id={`holiday-site-${site.id}`}
                label={site.name}
                checked={siteIds.includes(site.id)}
                onChange={(event) =>
                  setSiteIds((current) =>
                    event.target.checked
                      ? [...current, site.id]
                      : current.filter((id) => id !== site.id),
                  )
                }
              />
            ))}
          </fieldset>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit || create.isPending}>
            {create.isPending ? 'Declaring…' : 'Declare holiday'}
          </Button>
        </div>
      </form>

      <DataTable
        caption="Declared holidays"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No holidays declared."
      />
    </div>
  );
}
