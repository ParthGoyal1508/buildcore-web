'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  deactivateWorker,
  enrolWorkerFace,
  getMyLabourSites,
  getWorkers,
  type Worker,
} from '@/app/lib/api/labour';
import {
  LABOUR_ENROLMENT_PHOTOS,
  LABOUR_GENDER_LABELS,
  ROUTES,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import FacePhotoPicker from '@/app/ui/labour/face-photo-picker';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';
import { NocModal } from '@/app/ui/nocs/noc-panel';

/**
 * The labour registry (031). Registration happens on the field screen, because it needs the
 * camera for the 3–5 face photos; this list links there. Supervisors see only their assigned
 * sites' labour; the HR office sees everyone.
 */
export default function WorkersPage() {
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState('');
  // The worker a NOC is being managed for (2026-10-15).
  const [nocFor, setNocFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [search, setSearch] = useState('');
  const [deactivating, setDeactivating] = useState<Worker | null>(null);
  const [photosFor, setPhotosFor] = useState<Worker | null>(null);

  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });
  const workers = useQuery({
    queryKey: ['workers', siteId, search],
    queryFn: () =>
      getWorkers({
        siteId: siteId || undefined,
        search: search || undefined,
        pageSize: 200,
      }),
  });

  const siteName = (id: string) =>
    sites.data?.find((s) => s.id === id)?.name ?? '—';

  const columns: Column<Worker>[] = [
    { key: 'code', header: 'Code', render: (w) => w.labourCode },
    { key: 'name', header: 'Name', render: (w) => w.fullName },
    {
      key: 'father',
      header: "Father's name",
      render: (w) => w.fatherName ?? '—',
      hideOnCard: true,
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (w) =>
        w.gender ? (
          LABOUR_GENDER_LABELS[w.gender]
        ) : (
          // Pre-031 labour whose free-text gender did not read as male or female: no rate applies
          // until it is set, and the payment sheet says so by name.
          <span className="text-amber-700">Not set</span>
        ),
    },
    {
      key: 'phone',
      header: 'Mobile',
      render: (w) => w.phone ?? '—',
      hideOnCard: true,
    },
    { key: 'site', header: 'Site', render: (w) => siteName(w.siteId) },
    {
      key: 'face',
      header: 'Face',
      render: (w) =>
        w.faceEnrolled ? (
          <StatusBadge status="active" label="Registered" />
        ) : (
          <StatusBadge status="pending" label="No photos" />
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => <StatusBadge status={w.status} />,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Labour"
          description="Everyone registered for attendance. Codes are issued automatically."
        />
        <Link
          href={ROUTES.labourRegister}
          className="flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-500 sm:h-10"
        >
          Register Labour
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="filter-site"
          label="Site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">All sites</option>
          {sites.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="filter-search"
          label="Search"
          placeholder="Name, code, father's name or mobile"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={workers.data?.items ?? []}
        rowKey={(w) => w.id}
        isLoading={workers.isPending}
        error={workers.isError ? 'Could not load labour.' : null}
        emptyMessage="No labour matches these filters."
        actions={(w) => (
          <>
            {w.status === 'active' && (
              <RowAction onClick={() => setPhotosFor(w)}>
                {w.faceEnrolled ? 'Retake photos' : 'Add photos'}
              </RowAction>
            )}
            <RowAction
              intent="read"
              onClick={() => setNocFor({ id: w.id, name: w.fullName })}
            >
              NOC
            </RowAction>
            {w.status === 'active' && (
              <RowAction onClick={() => setDeactivating(w)}>
                Deactivate
              </RowAction>
            )}
          </>
        )}
      />

      {nocFor && (
        <NocModal
          subjectType="labour_worker"
          subjectId={nocFor.id}
          title={`NOC — ${nocFor.name}`}
          onClose={() => setNocFor(null)}
        />
      )}

      {photosFor && (
        <FacePhotosForm
          worker={photosFor}
          onClose={() => setPhotosFor(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['workers'] });
            setPhotosFor(null);
          }}
        />
      )}

      {deactivating && (
        <DeactivateForm
          worker={deactivating}
          onClose={() => setDeactivating(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            setDeactivating(null);
          }}
        />
      )}
    </div>
  );
}

/** Takes (or replaces) a labour's 3–5 face photos — for anyone registered before 031, or whose
 * face has changed enough that matching keeps refusing them. */
function FacePhotosForm({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => enrolWorkerFace(worker.id, photos),
    onSuccess: onSaved,
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status === 400
          ? e.message
          : 'Could not save the photos.',
      ),
  });

  return (
    <Modal
      title={`Face photos — ${worker.fullName}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            disabled={photos.length < LABOUR_ENROLMENT_PHOTOS.min || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save photos'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        {worker.faceEnrolled && (
          <p className="text-sm text-gray-600">
            These replace the photos taken before.
          </p>
        )}
        <FacePhotoPicker photos={photos} onChange={setPhotos} />
      </div>
    </Modal>
  );
}

function DeactivateForm({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => deactivateWorker(worker.id, { reason, lastWorkingDate }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : 'Could not deactivate the worker.',
      ),
  });

  return (
    <Modal
      title={`Deactivate ${worker.fullName}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!reason || !lastWorkingDate}
          >
            Deactivate
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          The worker will be removed from their gang and excluded from future
          musters. Any unsettled payment lines are flagged for settlement.
        </p>
        <TextField
          id="d-date"
          label="Last working date"
          type="date"
          value={lastWorkingDate}
          onChange={(e) => setLastWorkingDate(e.target.value)}
        />
        <TextField
          id="d-reason"
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}
