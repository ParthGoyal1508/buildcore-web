'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { Suspense, useState } from 'react';

import { ApiError, errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
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
import { dateLabel, todayIso } from '@/app/lib/format';
import {
  urlEnum,
  urlNumber,
  urlString,
  useUrlState,
} from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import Pager from '@/app/ui/inventory/pager';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';
import FacePhotoPicker from '@/app/ui/labour/face-photo-picker';
import {
  EditWorkerForm,
  TransferWorkerForm,
} from '@/app/ui/labour/worker-edit-forms';
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
import {
  NocFilterField,
  NocStatusBadge,
  useNocStatuses,
} from '@/app/ui/nocs/noc-status';

/**
 * The labour registry (031). Registration happens on the field screen, because it needs the
 * camera for the 3–5 face photos; this list links there. Supervisors see only their assigned
 * sites' labour; the HR office sees everyone.
 */
const PAGE_SIZE = 25;

function WorkersPageBody() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  // 036 O11: paged on the server, search debounced, filters in the URL. The list loaded
  // `pageSize: 200` with no pager, so the 201st worker silently did not exist. 042: the NOC
  // filter joins them — on the server too, so it narrows the whole register and the pager's
  // totals stay honest (it used to filter only the loaded page).
  const [filters, setFilters, query] = useUrlState(
    {
      site: urlString(),
      q: urlString(),
      noc: urlEnum(['', 'open', 'closed'] as const, ''),
      page: urlNumber(1),
    },
    { debounce: ['q'], resetPage: 'page' },
  );
  // The worker a NOC is being managed for (2026-10-15).
  const [nocFor, setNocFor] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deactivating, setDeactivating] = useState<Worker | null>(null);
  const [photosFor, setPhotosFor] = useState<Worker | null>(null);
  // 052: editing a worker's details, and moving them to another site.
  const [editing, setEditing] = useState<Worker | null>(null);
  const [transferring, setTransferring] = useState<Worker | null>(null);

  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });
  const params = {
    siteId: query.site || undefined,
    search: query.q.trim() || undefined,
    nocStatus: query.noc || undefined,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
  const workers = useQuery({
    queryKey: ['workers', companyId, params],
    queryFn: () => getWorkers(params),
    placeholderData: keepPreviousData,
  });
  // The per-row badge still needs each listed worker's status (2026-10-17).
  const nocStatuses = useNocStatuses(
    'labour_worker',
    (workers.data?.items ?? []).map((w) => w.id),
  );

  const siteName = (id: string) =>
    sites.data?.find((s) => s.id === id)?.name ?? '—';

  const columns: Column<Worker>[] = [
    { key: 'code', header: 'Code', render: (w) => w.labourCode },
    {
      key: 'name',
      header: 'Name',
      sortValue: (w) => w.fullName,
      // 052: father's name and mobile sit under the name, which leaves room for the contractor and
      // the Edit and Transfer actions without the table scrolling sideways.
      render: (w) => (
        <>
          {w.fullName}
          {w.fatherName && (
            <span className="block text-xs text-gray-500">
              Father: {w.fatherName}
            </span>
          )}
          {w.phone && (
            <span className="block text-xs text-gray-500">{w.phone}</span>
          )}
        </>
      ),
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
      key: 'contractor',
      header: 'Contractor',
      // 052: who engaged them; direct labour is paid in cash from the site sheet.
      render: (w) =>
        w.engagementType === 'contractor' ? (
          w.contractorName ?? '—'
        ) : (
          <span className="text-gray-500">Direct</span>
        ),
    },
    { key: 'site', header: 'Site', render: (w) => siteName(w.siteId) },
    {
      // 052: status, face photos and NOC stacked in one column, which leaves room for the Edit and
      // Transfer actions without the table scrolling sideways.
      key: 'status',
      header: 'Status',
      sortValue: (w) => w.status,
      render: (w) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={w.status} />
          {w.faceEnrolled ? (
            <StatusBadge status="active" label="Photos" />
          ) : (
            <StatusBadge status="pending" label="No photos" />
          )}
          <NocStatusBadge status={nocStatuses?.get(w.id)} />
        </div>
      ),
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
          className="flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-500 sm:h-10"
        >
          Register Labour
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          id="filter-site"
          label="Site"
          value={filters.site}
          onChange={(e) => setFilters({ site: e.target.value })}
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
          type="search"
          value={filters.q}
          onChange={(e) => setFilters({ q: e.target.value })}
        />
        <NocFilterField
          id="filter-noc"
          value={filters.noc}
          onChange={(noc) => setFilters({ noc })}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={workers.data?.items ?? []}
        rowKey={(w) => w.id}
        isLoading={workers.isPending}
        error={workers.error}
        onRetry={workers.refetch}
        serverPaged
        isRefreshing={workers.isPlaceholderData && workers.isFetching}
        emptyMessage="No labour matches these filters."
        actions={(w) => (
          <>
            <RowAction onClick={() => setEditing(w)}>Edit</RowAction>
            {/* A transfer needs a second site the caller works at. */}
            {w.status === 'active' && (sites.data?.length ?? 0) > 1 && (
              <RowAction onClick={() => setTransferring(w)}>Transfer</RowAction>
            )}
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

      <div className="mt-4">
        <Pager
          total={workers.data?.total ?? 0}
          page={query.page}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => setFilters({ page })}
          noun="worker"
        />
      </div>

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
            toast.success('Face photos saved.');
            void queryClient.invalidateQueries({ queryKey: ['workers'] });
            setPhotosFor(null);
          }}
        />
      )}

      {editing && (
        <EditWorkerForm
          worker={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            toast.success(`${saved.fullName}'s details saved.`);
            void queryClient.invalidateQueries({ queryKey: ['workers'] });
            void queryClient.invalidateQueries({ queryKey: ['worker', saved.id] });
            setEditing(null);
          }}
        />
      )}

      {transferring && (
        <TransferWorkerForm
          worker={transferring}
          sites={sites.data ?? []}
          currentSiteName={siteName(transferring.siteId)}
          onClose={() => setTransferring(null)}
          onSaved={(saved) => {
            toast.success(`${saved.fullName} moved to ${siteName(saved.siteId)}.`);
            void queryClient.invalidateQueries({ queryKey: ['workers'] });
            void queryClient.invalidateQueries({ queryKey: ['worker', saved.id] });
            setTransferring(null);
          }}
        />
      )}

      {deactivating && (
        <DeactivateForm
          worker={deactivating}
          onClose={() => setDeactivating(null)}
          onSaved={() => {
            toast.success(`${deactivating.fullName} deactivated.`);
            void queryClient.invalidateQueries({ queryKey: ['workers'] });
            setDeactivating(null);
          }}
        />
      )}
    </div>
  );
}

export default function WorkersPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <ListSkeleton
          headers={['Code', 'Name', 'Gender', 'Contractor', 'Site', 'Status']}
          rows={8}
        />
      }
    >
      <WorkersPageBody />
    </Suspense>
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
      isDirty={photos.length > 0}
      pending={save.isPending}
      // O15: buttons passed straight to the footer, so a phone stacks them full width.
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={save.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            disabled={photos.length < LABOUR_ENROLMENT_PHOTOS.min}
            loading={save.isPending}
          >
            Save photos
          </Button>
        </>
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
    mutationFn: () =>
      deactivateWorker(worker.id, { reason: reason.trim(), lastWorkingDate }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(errorMessage(e, 'Could not deactivate the worker.')),
  });

  // 036 O11: a last working day in the future was accepted.
  const today = todayIso();
  const futureDate = !!lastWorkingDate && lastWorkingDate > today;

  return (
    <Modal
      title={`Deactivate ${worker.fullName}`}
      onClose={onClose}
      isDirty={!!reason || !!lastWorkingDate}
      pending={mutation.isPending}
      // O15: buttons passed straight to the footer, so a phone stacks them full width.
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!reason.trim() || !lastWorkingDate || futureDate}
            loading={mutation.isPending}
          >
            Deactivate
          </Button>
        </>
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
          label="Last working date *"
          type="date"
          required
          max={today}
          value={lastWorkingDate}
          onChange={(e) => setLastWorkingDate(e.target.value)}
          error={
            futureDate ? `Today (${dateLabel(today)}) at the latest.` : undefined
          }
        />
        <TextField
          id="d-reason"
          label="Reason *"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}
