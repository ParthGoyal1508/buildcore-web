'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  blobToBase64,
  captureMuster,
  getGangs,
  getWorkers,
  type Worker,
} from '@/app/lib/api/labour';
import {
  ATTENDANCE_TYPES,
  labourLabel,
} from '@/app/lib/constants';
import { isAccurateEnough, resolvePosition } from '@/app/lib/location';
import {
  drainMusters,
  enqueueMuster,
  getQueuedMusterCount,
  type MusterQueueEntry,
} from '@/app/lib/offline-queue';
import { getSites } from '@/app/lib/api/projects';
import { Button } from '@/app/ui/button';
import CameraCapture from '@/app/ui/my/camera-capture';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

interface Mark {
  attendanceType: string;
  overtimeHours?: number;
  photo?: Blob;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function MusterCapturePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [siteId, setSiteId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [capturingFor, setCapturingFor] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const sites = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => getSites({ pageSize: 200 }),
  });
  const workers = useQuery({
    queryKey: ['muster-workers', siteId],
    queryFn: () => getWorkers({ siteId, status: 'active', pageSize: 200 }),
    enabled: !!siteId && step >= 2,
  });
  const gangs = useQuery({
    queryKey: ['muster-gangs', siteId],
    queryFn: () => getGangs({ siteId }),
    enabled: !!siteId && step >= 2,
  });

  const refreshQueued = useCallback(async () => {
    const count = await getQueuedMusterCount();
    setQueuedCount(count);
  }, []);

  const syncQueued = useCallback(async (): Promise<string | null> => {
    const result = await drainMusters(async (entry: MusterQueueEntry) => {
      const lines = await Promise.all(
        entry.lines.map(async (l) => ({
          workerId: l.workerId,
          attendanceType: l.attendanceType,
          overtimeHours: l.overtimeHours,
          photo: await blobToBase64(l.photo),
        })),
      );
      return captureMuster({
        siteId: entry.siteId,
        date: entry.date,
        latitude: entry.latitude,
        longitude: entry.longitude,
        accuracyMetres: entry.accuracyMetres,
        capturedAt: entry.capturedAt,
        lines,
      });
    });
    return result.failures.length > 0
      ? `Some queued musters could not sync: ${result.failures
          .map((f) => f.reason)
          .join('; ')}`
      : null;
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const failure = await syncQueued();
      if (!active) return;
      if (failure) setSubmitError(failure);
      const count = await getQueuedMusterCount();
      if (active) setQueuedCount(count);
    };
    run();
    const onOnline = () => void run();
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
    };
  }, [syncQueued]);

  const locate = async () => {
    setLocating(true);
    setGpsError(null);
    try {
      setPosition(await resolvePosition());
    } catch (e) {
      setGpsError(e instanceof Error ? e.message : 'Could not get a location.');
      setPosition(null);
    } finally {
      setLocating(false);
    }
  };

  const setMark = (workerId: string, patch: Partial<Mark>) =>
    setMarks((m) => {
      const existing: Mark = m[workerId] ?? { attendanceType: 'full_day' };
      return { ...m, [workerId]: { ...existing, ...patch } };
    });
  const unmark = (workerId: string) =>
    setMarks((m) => {
      const next = { ...m };
      delete next[workerId];
      return next;
    });

  const markGang = (memberIds: string[]) =>
    setMarks((m) => {
      const next = { ...m };
      for (const id of memberIds)
        if (!next[id]) next[id] = { attendanceType: 'full_day' };
      return next;
    });

  const markedIds = Object.keys(marks);
  const missingPhotos = markedIds.filter((id) => !marks[id].photo).length;

  const submit = useMutation({
    mutationFn: async () => {
      if (!position) throw new Error('Location required');
      const base = {
        siteId,
        date,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMetres: position.coords.accuracy,
        capturedAt: new Date().toISOString(),
      };
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const entry: MusterQueueEntry = {
          ...base,
          lines: markedIds.map((id) => ({
            workerId: id,
            attendanceType: marks[id].attendanceType,
            overtimeHours: marks[id].overtimeHours,
            photo: marks[id].photo as Blob,
          })),
        };
        await enqueueMuster(entry);
        await refreshQueued();
        return 'queued' as const;
      }
      const lines = await Promise.all(
        markedIds.map(async (id) => ({
          workerId: id,
          attendanceType: marks[id].attendanceType,
          overtimeHours: marks[id].overtimeHours,
          photo: await blobToBase64(marks[id].photo as Blob),
        })),
      );
      await captureMuster({ ...base, lines });
      return 'submitted' as const;
    },
    onSuccess: () => {
      setSubmitted(true);
      setSubmitError(null);
    },
    onError: (e) =>
      setSubmitError(
        e instanceof ApiError ? e.message : 'Could not submit the muster.',
      ),
  });

  const lowAccuracy = position ? !isAccurateEnough(position) : false;

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Muster submitted</h1>
        <p className="text-sm text-gray-600">
          {markedIds.length} workers marked for {date}.
        </p>
        <Button
          className="mx-auto justify-center"
          onClick={() => {
            setStep(1);
            setMarks({});
            setPosition(null);
            setSubmitted(false);
          }}
        >
          New muster
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Muster Capture</h1>
        <span className="text-xs text-gray-500">Step {step} of 3</span>
      </div>
      {queuedCount > 0 && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {queuedCount} muster(s) queued offline — will sync automatically.
        </div>
      )}
      <FormError message={submitError} />

      {step === 1 && (
        <div className="space-y-3">
          <SelectField
            id="m-site"
            label="Site"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Select…</option>
            {sites.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TextField
            id="m-date"
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="rounded-md border border-gray-100 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Location
              </span>
              <SecondaryButton onClick={locate} disabled={locating}>
                {locating ? 'Locating…' : position ? 'Refresh' : 'Get location'}
              </SecondaryButton>
            </div>
            {position && (
              <p className="mt-2 text-sm text-gray-600">
                Accuracy: {Math.round(position.coords.accuracy)} m
              </p>
            )}
            {gpsError && (
              <p className="mt-2 text-sm text-red-600">{gpsError}</p>
            )}
            {lowAccuracy && (
              <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">
                GPS accuracy is low — the muster will be flagged for approval. You
                can still proceed.
              </p>
            )}
          </div>
          <Button
            className="w-full justify-center"
            onClick={() => setStep(2)}
            disabled={!siteId || !position}
          >
            Continue
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {gangs.data && gangs.data.length > 0 && (
            <div className="rounded-md border border-gray-100 p-3">
              <p className="mb-2 text-sm font-medium text-gray-700">
                Mark a whole gang
              </p>
              <div className="flex flex-wrap gap-2">
                {gangs.data.map((g) => (
                  <SecondaryButton
                    key={g.id}
                    onClick={() => markGang(g.memberWorkerIds)}
                  >
                    {g.name}
                  </SecondaryButton>
                ))}
              </div>
            </div>
          )}

          {workers.isPending && (
            <p className="text-sm text-gray-500">Loading workers…</p>
          )}
          <div className="space-y-2">
            {workers.data?.items.map((w: Worker) => {
              const mark = marks[w.id];
              return (
                <div
                  key={w.id}
                  className="rounded-lg border border-gray-100 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {w.fullName}
                      </p>
                      <p className="text-xs text-gray-500">{w.labourCode}</p>
                    </div>
                    {mark ? (
                      <SecondaryButton onClick={() => unmark(w.id)}>
                        Unmark
                      </SecondaryButton>
                    ) : (
                      <Button onClick={() => setMark(w.id, {})}>Mark</Button>
                    )}
                  </div>
                  {mark && (
                    <div className="mt-3 space-y-2">
                      <SelectField
                        id={`att-${w.id}`}
                        label="Attendance"
                        value={mark.attendanceType}
                        onChange={(e) =>
                          setMark(w.id, { attendanceType: e.target.value })
                        }
                      >
                        {ATTENDANCE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {labourLabel(t)}
                          </option>
                        ))}
                      </SelectField>
                      {mark.attendanceType === 'overtime_only' && (
                        <TextField
                          id={`ot-${w.id}`}
                          label="Overtime hours"
                          type="number"
                          min="0"
                          step="0.5"
                          value={mark.overtimeHours ?? ''}
                          onChange={(e) =>
                            setMark(w.id, {
                              overtimeHours: Number(e.target.value),
                            })
                          }
                        />
                      )}
                      <div className="flex items-center gap-2">
                        {mark.photo ? (
                          <span className="text-sm text-green-700">
                            Photo captured ✓
                          </span>
                        ) : (
                          <span className="text-sm text-amber-700">
                            Photo required
                          </span>
                        )}
                        <SecondaryButton onClick={() => setCapturingFor(w.id)}>
                          {mark.photo ? 'Retake' : 'Capture photo'}
                        </SecondaryButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
            <Button
              className="flex-1 justify-center"
              onClick={() => setStep(3)}
              disabled={markedIds.length === 0}
            >
              Review ({markedIds.length})
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-sm font-medium text-gray-900">
              {markedIds.length} workers marked
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {ATTENDANCE_TYPES.map((t) => {
                const count = markedIds.filter(
                  (id) => marks[id].attendanceType === t,
                ).length;
                return count > 0 ? (
                  <li key={t}>
                    {labourLabel(t)}: {count}
                  </li>
                ) : null;
              })}
            </ul>
            {missingPhotos > 0 && (
              <p className="mt-2 text-sm text-amber-800">
                {missingPhotos} marked worker(s) still need a photo.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
            <Button
              className="flex-1 justify-center"
              onClick={() => submit.mutate()}
              disabled={missingPhotos > 0 || submit.isPending}
            >
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </div>
      )}

      {capturingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-4">
            <CameraCapture
              captureLabel="Capture worker photo"
              onCancel={() => setCapturingFor(null)}
              onCapture={(blob) => {
                setMark(capturingFor, { photo: blob });
                setCapturingFor(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
