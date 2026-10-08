'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getProjects, getSite } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES, projectsLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import SiteModal from '@/app/ui/projects/site-modal';
import StatusBadge from '@/app/ui/status-badge';
import { DetailCard, Fact, OpenLink } from '@/app/ui/projects/detail-card';

/** 0 = Sunday, as `Site.weeklyOffDay` stores it. */
const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * One site — its geofence, its address and the project it belongs to (2026-10-09).
 *
 * The list shows coordinates to five places and a radius, which is enough to recognise a site
 * and not enough to check one. This page is where the geofence is read before somebody is told
 * their punch fell outside it.
 *
 * **No endpoint was added**: `GET /projects/sites/:id` has existed since 003 and already returns
 * the geofence and weekly-off columns that feature owns.
 *
 * The project's name comes from the same cached portfolio query the list uses to fill its
 * Project column, under the same key — so arriving here from the list costs no request, and the
 * fallback says the project exists rather than printing its id, exactly as the list does.
 */
export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [editing, setEditing] = useState(false);

  const site = useQuery({
    queryKey: ['projects', 'site', id],
    queryFn: () => getSite(id),
  });

  const projects = useQuery({
    queryKey: ['projects', 'portfolio', { pageSize: 200 }],
    queryFn: () => getProjects({ pageSize: 200 }),
  });

  if (site.isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (site.isError || !site.data) {
    return (
      <main>
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {MESSAGES.loadFailed}
        </p>
        <p className="mt-3 text-sm">
          <Link href={ROUTES.projectsSites} className="text-blue-700 underline">
            Back to sites
          </Link>
        </p>
      </main>
    );
  }

  const row = site.data;
  const project = row.projectId
    ? projects.data?.items.find((p) => p.id === row.projectId)
    : undefined;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {row.name}
            <StatusBadge status={row.status} />
          </span>
        }
        description={
          <Link href={ROUTES.projectsSites} className="text-blue-700 underline">
            Sites
          </Link>
        }
        actions={<Button onClick={() => setEditing(true)}>Edit site</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/*
          Its own card, and the first one. The coordinates and the radius are what decide
          whether a worker's punch counts, so they are the thing somebody opens a site to check
          — and `Decimal(10,7)` is seven places because the seventh is about a centimetre.
        */}
        <DetailCard heading="Geofence">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact term="Latitude">
              <span className="tabular-nums">{row.latitude.toFixed(7)}</span>
            </Fact>
            <Fact term="Longitude">
              <span className="tabular-nums">{row.longitude.toFixed(7)}</span>
            </Fact>
            <Fact term="Radius">
              <span className="tabular-nums">{row.geofenceRadiusMeters}</span> m
            </Fact>
            <Fact term="Weekly off">
              {DAYS[row.weeklyOffDay] ?? `Day ${row.weeklyOffDay}`}
            </Fact>
          </dl>
          <p className="mt-3 text-xs text-gray-500">
            A punch inside this circle counts as on site. The address below is where a
            delivery goes, which is not the same question.
          </p>
        </DetailCard>

        <DetailCard heading="Where it is">
          <dl className="grid gap-3">
            <Fact term="Address">{row.address || '—'}</Fact>
            <Fact term="Project">
              {!row.projectId ? (
                // Nullable by design: a site created by 003 predates projects entirely, and a
                // site can outlive the project it was opened for.
                <span className="text-gray-600">
                  Not attached to a project
                </span>
              ) : project ? (
                <span className="flex flex-wrap items-center gap-3">
                  {project.code} — {project.name}
                  <span className="text-xs text-gray-600">
                    {projectsLabel(project.status)}
                  </span>
                  <OpenLink href={ROUTES.projectsProject(project.id)} />
                </span>
              ) : (
                <span className="flex flex-wrap items-center gap-3">
                  Linked project
                  <OpenLink href={ROUTES.projectsProject(row.projectId)} />
                </span>
              )}
            </Fact>
          </dl>
        </DetailCard>
      </div>

      {editing && <SiteModal site={row} onClose={() => setEditing(false)} />}
    </main>
  );
}
