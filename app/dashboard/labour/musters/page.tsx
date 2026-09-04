'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { getMusters, type MusterListItem } from '@/app/lib/api/labour';
import { getSites } from '@/app/lib/api/projects';
import { MUSTER_STATUSES, ROUTES } from '@/app/lib/constants';
import { RowAction, SelectField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function MustersPage() {
  const [status, setStatus] = useState('submitted');

  const sites = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => getSites({ pageSize: 200 }),
  });
  const musters = useQuery({
    queryKey: ['musters', status],
    queryFn: () => getMusters({ status }),
  });

  const siteName = (id: string) =>
    sites.data?.items.find((s) => s.id === id)?.name ?? id;

  const columns: Column<MusterListItem>[] = [
    { key: 'date', header: 'Date', render: (m) => m.date },
    { key: 'site', header: 'Site', render: (m) => siteName(m.siteId) },
    { key: 'lines', header: 'Workers', render: (m) => `${m.lineCount}` },
    {
      key: 'flags',
      header: 'Flags',
      render: (m) => (
        <span className="flex flex-wrap gap-1">
          {m.geofenceViolation && (
            <StatusBadge status="warning" label="Geofence" />
          )}
          {m.lowGpsAccuracy && <StatusBadge status="warning" label="Low GPS" />}
          {m.faceMatchLowCount > 0 && (
            <StatusBadge
              status="info"
              label={`${m.faceMatchLowCount} face review`}
            />
          )}
          {!m.geofenceViolation &&
            !m.lowGpsAccuracy &&
            m.faceMatchLowCount === 0 &&
            '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => <StatusBadge status={m.status} />,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Musters</h1>
          <p className="text-sm text-gray-500">
            Review and approve supervisor attendance, oldest first.
          </p>
        </div>
        <SelectField
          id="muster-status"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {MUSTER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </SelectField>
      </div>

      <ResponsiveList
        columns={columns}
        rows={musters.data ?? []}
        rowKey={(m) => m.id}
        isLoading={musters.isPending}
        error={musters.isError ? 'Could not load musters.' : null}
        emptyMessage="No musters in this state."
        actions={(m) => (
          <Link href={ROUTES.labourMuster(m.id)}>
            <RowAction>Open</RowAction>
          </Link>
        )}
      />
    </div>
  );
}
