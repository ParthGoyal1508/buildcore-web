'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getClient, getProjects } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES, projectsLabel } from '@/app/lib/constants';
import { formatDateToLocal, formatRupees } from '@/app/lib/utils';
import { Button } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import ClientModal from '@/app/ui/projects/client-modal';
import StatusBadge from '@/app/ui/status-badge';
import { Fact, DetailCard, OpenLink } from '@/app/ui/projects/detail-card';

/**
 * One client — what is on file about them, and what they have given us (2026-10-09).
 *
 * The list has always shown a `projectCount`, and the reader's next question is always *which
 * ones*. Until this page the only answer was to leave for the portfolio and set its client
 * filter, which is a round trip through a screen nobody wanted in order to read a list the
 * server will happily return directly.
 *
 * **No endpoint was added.** `GET /projects/clients/:id` has existed since 008 and the portfolio
 * list has filtered by `clientId` for as long; this page is the two of them on one screen. The
 * project query shares the portfolio's own key shape, so arriving here from a filtered portfolio
 * costs nothing.
 */
export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [editing, setEditing] = useState(false);

  const client = useQuery({
    queryKey: ['projects', 'client', id],
    queryFn: () => getClient(id),
  });

  /**
   * The client's projects.
   *
   * `enabled` on the client having loaded, so a 404 on the client does not fire a second request
   * for a filter that cannot resolve.
   */
  const projects = useQuery({
    queryKey: ['projects', 'portfolio', { clientId: id, pageSize: 100 }],
    queryFn: () => getProjects({ clientId: id, pageSize: 100 }),
    enabled: Boolean(client.data),
  });

  if (client.isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (client.isError || !client.data) {
    return (
      <main>
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {MESSAGES.loadFailed}
        </p>
        <p className="mt-3 text-sm">
          <Link href={ROUTES.projectsClients} className="text-blue-700 underline">
            Back to clients
          </Link>
        </p>
      </main>
    );
  }

  const row = client.data;
  const rows = projects.data?.items ?? [];

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
          <Link href={ROUTES.projectsClients} className="text-blue-700 underline">
            Clients
          </Link>
        }
        actions={<Button onClick={() => setEditing(true)}>Edit client</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard heading="Contact">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact term="Contact person">{row.contactPerson || '—'}</Fact>
            <Fact term="Phone">{row.phone || '—'}</Fact>
            <Fact term="Email">{row.email || '—'}</Fact>
            <Fact term="Address">{row.address || '—'}</Fact>
          </dl>
        </DetailCard>

        {/*
          Separate from Contact, because these three are what a bill to this client is built
          from: the GSTIN decides whether a bill is taxed at the half-rate pair or the single
          full rate, and an absent PAN or state is reported on the bill's own header as a gap.
        */}
        <DetailCard heading="Statutory">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact term="GSTIN">{row.gstin || '—'}</Fact>
            <Fact term="PAN">{row.pan || '—'}</Fact>
            <Fact term="GST state code">{row.state || '—'}</Fact>
          </dl>
        </DetailCard>
      </div>

      <DetailCard heading={`Projects (${rows.length})`}>
        {projects.isLoading ? (
          <p className="text-sm text-gray-500" role="status">
            Loading…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-600">
            No projects for this client yet. A client with none can be deleted; one with
            any cannot.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {project.code} — {project.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {projectsLabel(project.status)}
                    {project.startDate
                      ? ` · from ${formatDateToLocal(project.startDate)}`
                      : ''}
                    {project.contractValue != null
                      ? ` · ${formatRupees(Number(project.contractValue))}`
                      : ''}
                  </p>
                </div>
                <OpenLink href={ROUTES.projectsProject(project.id)} />
              </li>
            ))}
          </ul>
        )}
      </DetailCard>

      {editing && (
        <ClientModal client={row} onClose={() => setEditing(false)} />
      )}
    </main>
  );
}
