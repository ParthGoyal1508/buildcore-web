'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { getMusters, type MusterListItem } from '@/app/lib/api/labour';
import { MUSTER_STATUSES, ROUTES } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import {
  RowAction,
  SecondaryButton,
  SelectField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

export default function MustersPage() {
  const [status, setStatus] = useState('submitted');
  const companyId = useSelectedCompanyId();

  const musters = useQuery({
    queryKey: ['musters', companyId, status],
    queryFn: () => getMusters({ status }),
  });

  // 036 O8: the site and supervisor names come with each muster; the page used to look sites up
  // in the first 200 of a separate list and show the raw id past that.
  const columns: Column<MusterListItem>[] = [
    { key: 'date', header: 'Date', render: (m) => dateLabel(m.date) },
    {
      key: 'site',
      header: 'Site',
      render: (m) => (
        <>
          {m.siteName ?? 'Unknown site'}
          {m.supervisorName && (
            <span className="block text-xs text-gray-500">{m.supervisorName}</span>
          )}
        </>
      ),
    },
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Musters"
          description="Review and approve supervisor attendance, oldest first."
        />
        <div className="flex min-w-[16rem] flex-1 items-end gap-2 sm:flex-none">
          <div className="min-w-0 flex-1">
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
          {/* Since 031 a day's muster is built from the supervisors' face punches; this is
              where you stand when you notice one is missing. */}
          <Link href={ROUTES.labourAttendance}>
            <SecondaryButton type="button">Mark attendance</SecondaryButton>
          </Link>
        </div>
      </div>

      <ResponsiveList
        columns={columns}
        rows={musters.data ?? []}
        rowKey={(m) => m.id}
        isLoading={musters.isPending}
        error={musters.error}
        onRetry={musters.refetch}
        emptyMessage="No musters in this state."
        actions={(m) => (
          <Link href={ROUTES.labourMuster(m.id)}>
            <RowAction intent="read">Open</RowAction>
          </Link>
        )}
      />
    </div>
  );
}
