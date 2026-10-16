'use client';

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  blobToBase64,
  getLabourRefusals,
  getLabourToday,
  getMyLabourSites,
  punchLabour,
  type LabourDayRow,
  type LabourPunchResult,
} from '@/app/lib/api/labour';
import {
  DEV_FALLBACK_POSITION,
  LABOUR_ATTENDANCE_COPY,
  LABOUR_PUNCH_MESSAGES,
  LABOUR_REFUSAL_REASON_LABELS,
  MESSAGES,
  ROUTES,
} from '@/app/lib/constants';
import { resolvePosition } from '@/app/lib/location';
import CameraCapture from '@/app/ui/my/camera-capture';
import PageHeader from '@/app/ui/page-header';
import { FormError, SelectField } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/** The last site picked on this phone, so a supervisor with several opens where they left off. */
const SITE_STORAGE_KEY = 'buildcore.labour.attendanceSite';

type Filter = 'all' | 'todo' | 'in' | 'done';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'todo', label: 'Not in' },
  { id: 'in', label: 'In' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

interface Target {
  worker: LabourDayRow;
  type: 'in' | 'out';
}

function readStoredSite(): string {
  try {
    return window.localStorage.getItem(SITE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeSite(siteId: string) {
  try {
    window.localStorage.setItem(SITE_STORAGE_KEY, siteId);
  } catch {
    // Private mode or blocked storage: the picker still works, it just is not remembered.
  }
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });

/** The user-facing sentence for a failed punch, by the API's code — never the server's prose. */
function punchErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code as keyof typeof LABOUR_PUNCH_MESSAGES | undefined;
    if (code && code in LABOUR_PUNCH_MESSAGES) return LABOUR_PUNCH_MESSAGES[code];
    if (error.status === 0) return LABOUR_ATTENDANCE_COPY.needsConnection;
  }
  if (error instanceof Error && error.message) return error.message;
  return MESSAGES.saveFailed;
}

/**
 * Labour attendance (031): the supervisor picks a labour, photographs them, and the photo is
 * matched against the face registered for them. Punch-in alone counts as a half day; punch-in
 * and punch-out as a full day. A face that does not match is refused.
 *
 * **Online only.** The face match happens on the server, so a queued photo would be a promise of
 * attendance nobody could check until later — and a refusal discovered hours after the labour has
 * gone home cannot be retaken.
 */
export default function LabourAttendancePage() {
  const queryClient = useQueryClient();
  // Null until the supervisor picks one; until then the remembered site, or the only one.
  const [chosenSite, setChosenSite] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');
  const [target, setTarget] = useState<Target | null>(null);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [notice, setNotice] = useState<{
    tone: 'ok' | 'warn';
    text: string;
  } | null>(null);

  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });

  const siteId =
    chosenSite ??
    (sites.data
      ? sites.data.find((s) => s.id === readStoredSite())?.id ??
        (sites.data.length === 1 ? sites.data[0].id : '')
      : '');

  const today = useQuery({
    queryKey: ['labour', 'today', siteId],
    queryFn: () => getLabourToday(siteId),
    enabled: !!siteId,
    refetchInterval: 60_000,
  });

  const refusals = useQuery({
    queryKey: ['labour', 'refusals', siteId],
    queryFn: () => getLabourRefusals(siteId, 1),
    enabled: !!siteId,
  });

  const counts = useMemo(() => {
    const items = today.data?.items ?? [];
    return {
      todo: items.filter((i) => !i.punchInAt).length,
      in: items.filter((i) => i.punchInAt && !i.punchOutAt).length,
      done: items.filter((i) => i.punchOutAt).length,
      all: items.length,
    };
  }, [today.data]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (today.data?.items ?? []).filter((i) => {
      if (filter === 'todo' && i.punchInAt) return false;
      if (filter === 'in' && (!i.punchInAt || i.punchOutAt)) return false;
      if (filter === 'done' && !i.punchOutAt) return false;
      if (!needle) return true;
      return [i.fullName, i.labourCode, i.fatherName ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [today.data, search, filter]);

  const onPunched = (result: LabourPunchResult, worker: LabourDayRow) => {
    setTarget(null);
    setNotice(
      result.geofenceViolation
        ? { tone: 'warn', text: LABOUR_ATTENDANCE_COPY.flaggedLocation }
        : {
            tone: 'ok',
            text: `${worker.fullName} punched ${result.type} at ${timeOf(
              result.punchedAt,
            )} — ${result.attendance === 'full_day' ? 'full day' : 'half day so far'}.`,
          },
    );
    void queryClient.invalidateQueries({ queryKey: ['labour', 'today', siteId] });
  };

  if (sites.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (sites.isError) {
    return <FormError message={MESSAGES.loadFailed} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Labour Attendance"
        description="Pick a labour, take their photo, and the face match marks them in or out."
        actions={
          siteId ? (
            <Link
              href={`${ROUTES.labourRegister}?siteId=${encodeURIComponent(siteId)}`}
              className="flex h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:border-brand-300 hover:bg-brand-50 sm:h-10"
            >
              <UserPlusIcon className="w-5" aria-hidden="true" />
              Register labour
            </Link>
          ) : null
        }
      />

      {!online && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {LABOUR_ATTENDANCE_COPY.needsConnection}
        </p>
      )}

      {sites.data.length === 0 ? (
        <p className="rounded-md bg-gray-100 px-3 py-3 text-sm text-gray-700">
          {LABOUR_ATTENDANCE_COPY.noSites}
        </p>
      ) : (
        sites.data.length > 1 && (
          <SelectField
            id="att-site"
            label="Site"
            value={siteId}
            onChange={(e) => {
              setChosenSite(e.target.value);
              storeSite(e.target.value);
              setNotice(null);
            }}
          >
            <option value="">Select a site…</option>
            {sites.data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        )
      )}
      {sites.data.length === 1 && (
        <p className="text-sm font-medium text-gray-700">{sites.data[0].name}</p>
      )}

      {notice && (
        <p
          role="status"
          className={clsx(
            'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
            notice.tone === 'ok'
              ? 'bg-green-50 text-green-900'
              : 'bg-amber-50 text-amber-900',
          )}
        >
          {notice.tone === 'ok' ? (
            <CheckCircleIcon className="mt-0.5 w-5 flex-none" aria-hidden="true" />
          ) : (
            <ExclamationTriangleIcon
              className="mt-0.5 w-5 flex-none"
              aria-hidden="true"
            />
          )}
          {notice.text}
        </p>
      )}

      {siteId && (
        <>
          <div className="relative">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 w-5 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <label htmlFor="att-search" className="sr-only">
              Search by name or code
            </label>
            <input
              id="att-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search name, code or father's name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block min-h-11 w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter labour"
            className="flex gap-2 overflow-x-auto"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  'flex h-9 flex-none items-center gap-1 rounded-full border px-3 text-sm font-medium',
                  filter === f.id
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                {f.label}
                <span
                  className={clsx(
                    'rounded-full px-1.5 text-xs',
                    filter === f.id ? 'bg-white/20' : 'bg-gray-100',
                  )}
                >
                  {counts[f.id]}
                </span>
              </button>
            ))}
          </div>

          {today.isPending ? (
            <p className="text-sm text-gray-500" role="status">
              <LoadingText />
            </p>
          ) : today.isError ? (
            <FormError message={MESSAGES.loadFailed} />
          ) : visible.length === 0 ? (
            <p className="rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
              {counts.all === 0
                ? 'No labour is registered at this site yet.'
                : search
                ? 'Nobody matches that search.'
                : filter === 'todo'
                ? 'Everyone here is punched in.'
                : 'Nobody in this list.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {visible.map((w) => (
                <LabourRow
                  key={w.workerId}
                  worker={w}
                  disabled={!online}
                  onPunch={(type) => {
                    setNotice(null);
                    setTarget({ worker: w, type });
                  }}
                />
              ))}
            </ul>
          )}

          {refusals.data && refusals.data.length > 0 && (
            <details className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <summary className="cursor-pointer font-medium text-gray-700">
                Refused today and yesterday ({refusals.data.length})
              </summary>
              <ul className="mt-2 space-y-1 text-gray-600">
                {refusals.data.map((r) => (
                  <li key={r.id}>
                    {timeOf(r.at)} · {r.fullName ?? 'Labour'}{' '}
                    {r.labourCode ? `(${r.labourCode})` : ''} · punch {r.type} ·{' '}
                    {LABOUR_REFUSAL_REASON_LABELS[r.reason] ?? r.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {target && (
        <PunchDialog
          siteId={siteId}
          target={target}
          onClose={() => {
            setTarget(null);
            void queryClient.invalidateQueries({
              queryKey: ['labour', 'refusals', siteId],
            });
          }}
          onDone={(result) => onPunched(result, target.worker)}
        />
      )}
    </div>
  );
}

function LabourRow({
  worker,
  disabled,
  onPunch,
}: {
  worker: LabourDayRow;
  disabled: boolean;
  onPunch: (type: 'in' | 'out') => void;
}) {
  const next: 'in' | 'out' | null = !worker.punchInAt
    ? 'in'
    : !worker.punchOutAt
    ? 'out'
    : null;
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">
          {worker.fullName}
        </p>
        <p className="truncate text-xs text-gray-500">
          {worker.labourCode}
          {worker.fatherName ? ` · S/o, D/o ${worker.fatherName}` : ''}
        </p>
        {(worker.punchInAt || worker.punchOutAt) && (
          <p className="mt-0.5 text-xs text-gray-600">
            {worker.punchInAt && `In ${timeOf(worker.punchInAt)}`}
            {worker.punchOutAt && ` · Out ${timeOf(worker.punchOutAt)}`}
          </p>
        )}
      </div>
      {!worker.faceEnrolled ? (
        <span className="flex-none rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
          No face photos
        </span>
      ) : next ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPunch(next)}
          className={clsx(
            'flex h-11 flex-none items-center rounded-lg px-4 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
            next === 'in'
              ? 'bg-blue-600 hover:bg-blue-500'
              : 'bg-gray-800 hover:bg-gray-700',
          )}
          aria-label={`Punch ${next} ${worker.fullName}`}
        >
          Punch {next}
        </button>
      ) : (
        <span className="flex flex-none items-center gap-1 text-xs font-medium text-green-700">
          <CheckCircleIcon className="w-5" aria-hidden="true" />
          Full day
        </span>
      )}
    </li>
  );
}

/**
 * Camera, then location, then the face match. Location is fetched after the photo rather than
 * before, so the supervisor is not standing with the camera open while the GPS settles — the
 * fix is usually ready by the time the shutter is pressed anyway, because `resolvePosition`
 * accepts one up to 30 seconds old.
 */
function PunchDialog({
  siteId,
  target,
  onClose,
  onDone,
}: {
  siteId: string;
  target: Target;
  onClose: () => void;
  onDone: (result: LabourPunchResult) => void;
}) {
  const [phase, setPhase] = useState<'camera' | 'locating' | 'matching'>(
    'camera',
  );
  const [error, setError] = useState<string | null>(null);

  const punch = useMutation({
    mutationFn: async (photo: Blob) => {
      setPhase('locating');
      let coords: { latitude: number; longitude: number; accuracy?: number };
      try {
        const position = await resolvePosition();
        coords = position.coords;
      } catch (e) {
        // A development build has no real fix to offer; production never falls back.
        if (process.env.NODE_ENV === 'production') throw e;
        coords = DEV_FALLBACK_POSITION;
      }
      setPhase('matching');
      return punchLabour({
        siteId,
        workerId: target.worker.workerId,
        type: target.type,
        photo: await blobToBase64(photo),
        latitude: coords.latitude,
        longitude: coords.longitude,
        ...(typeof coords.accuracy === 'number'
          ? { accuracyMeters: Math.round(coords.accuracy * 100) / 100 }
          : {}),
      });
    },
    onSuccess: onDone,
    onError: (e) => {
      setError(punchErrorMessage(e));
      setPhase('camera');
    },
  });

  // Escape closes, as every other dialog in the app does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !punch.isPending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, punch.isPending]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="punch-title"
    >
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <h2 id="punch-title" className="text-base font-semibold text-gray-900">
          Punch {target.type} · {target.worker.fullName}
        </h2>
        <p className="mb-3 text-xs text-gray-500">{target.worker.labourCode}</p>

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {phase === 'camera' ? (
          <CameraCapture
            captureLabel={error ? 'Retake photo' : 'Take photo'}
            disabled={punch.isPending}
            onCancel={onClose}
            onCapture={(blob) => {
              setError(null);
              punch.mutate(blob);
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 py-10" role="status">
            <LoadingText>
              {phase === 'locating'
                ? LABOUR_ATTENDANCE_COPY.locating
                : LABOUR_ATTENDANCE_COPY.matching}
            </LoadingText>
          </div>
        )}
      </div>
    </div>
  );
}
