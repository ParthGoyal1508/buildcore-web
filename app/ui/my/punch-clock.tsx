'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  getAttendanceHistory,
  submitPunch,
  type PunchResult,
} from '@/app/lib/api/my-workspace';
import { getEnrolmentStatus } from '@/app/lib/api/my-workspace';
import { MAX_GPS_ACCURACY_METERS, MESSAGES } from '@/app/lib/constants';
import { enqueue } from '@/app/lib/offline-queue';
import { Button } from '@/app/ui/button';
import { FormError } from '@/app/ui/settings/form-fields';
import CameraCapture from '@/app/ui/my/camera-capture';

/** HTTP 423 — the backend's status for a write into a closed payroll period. */
const HTTP_LOCKED = 423;

const two = (n: number) => String(n).padStart(2, '0');
const clockText = (date: Date) =>
  `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
const timeOnly = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Reads the current position, rejecting a fix too vague to be worth sending
 * (research.md §4, spec FR-007).
 *
 * The accuracy gate is here rather than only server-side because a reading accurate
 * to half a kilometre cannot distinguish inside from outside a 200-metre geofence.
 * Sending it anyway would produce an exception for an admin to resolve by hand, when
 * what the worker actually needs is to be told to wait a few seconds.
 */
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(MESSAGES.locationUnavailable));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (position.coords.accuracy > MAX_GPS_ACCURACY_METERS) {
          reject(new Error(MESSAGES.locationInaccurate(position.coords.accuracy)));
          return;
        }
        resolve(position);
      },
      (error) =>
        // A refusal and a failed fix need different advice: one is fixed in browser
        // settings, the other by moving somewhere with a clearer sky.
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? MESSAGES.locationDenied
              : MESSAGES.locationUnavailable,
          ),
        ),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

export default function PunchClock() {
  const queryClient = useQueryClient();
  const now = new Date();

  const [pendingType, setPendingType] = useState<'in' | 'out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [queuedNotice, setQueuedNotice] = useState(false);

  // --- Server-synced clock (research.md §7). ---
  //
  // One offset, computed once, then ticked locally. Polling every second to display
  // a clock would be a network request per second for a cosmetic value; a grossly
  // wrong device clock is the only thing worth correcting, and one reading catches
  // that. The `capturedAt` actually submitted is a fresh device timestamp, which
  // the backend validates on its own terms regardless.
  const offsetRef = useRef(0);
  const [displayTime, setDisplayTime] = useState(() => clockText(new Date()));

  useEffect(() => {
    let active = true;
    fetch('/', { method: 'HEAD' })
      .then((res) => {
        const serverDate = res.headers.get('date');
        if (serverDate && active) {
          offsetRef.current = new Date(serverDate).getTime() - Date.now();
        }
      })
      .catch(() => {
        // Offline, or the HEAD was blocked. The local clock is the fallback, which
        // is what would have been shown anyway.
      });

    const tick = setInterval(() => {
      if (active) setDisplayTime(clockText(new Date(Date.now() + offsetRef.current)));
    }, 1000);
    return () => {
      active = false;
      clearInterval(tick);
    };
  }, []);

  const { data: enrolment } = useQuery({
    queryKey: ['my', 'face-enrol'],
    queryFn: getEnrolmentStatus,
  });

  const { data: today } = useQuery({
    queryKey: ['my', 'attendance', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => getAttendanceHistory(now.getMonth() + 1, now.getFullYear()),
  });

  const todayKey = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  )
    .toISOString()
    .slice(0, 10);
  const todayRow = today?.find((day) => day.date === todayKey);
  const hasOpenPunchIn = Boolean(todayRow?.inTime && !todayRow?.outTime);
  const nextType: 'in' | 'out' = hasOpenPunchIn ? 'out' : 'in';

  const punch = useMutation({
    mutationFn: async ({ type, photo }: { type: 'in' | 'out'; photo: Blob }) => {
      const capturedAt = new Date().toISOString();
      const position = await getPosition();
      const input = {
        type,
        photo,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        capturedAt,
      };

      // Offline (US6, T031): queue rather than fail. The punch already happened —
      // the worker is standing at the gate — and the only thing missing is a
      // network, so refusing it would lose a real attendance event.
      if (!navigator.onLine) {
        await enqueue(input);
        return 'queued' as const;
      }

      try {
        return await submitPunch(input);
      } catch (err) {
        // A network-level failure is indistinguishable from being offline as far as
        // the punch is concerned. An ApiError means the server answered and had a
        // reason, which the worker needs to see rather than have silently queued.
        if (err instanceof ApiError) throw err;
        await enqueue(input);
        return 'queued' as const;
      }
    },
    onSuccess: (result) => {
      setPendingType(null);
      if (result === 'queued') {
        setQueuedNotice(true);
        setNotice(MESSAGES.punchQueued);
        return;
      }
      const punchResult = result as PunchResult;
      // A flagged punch is still a recorded punch (FR-007/FR-005). The notice is
      // informational, not an error, because there is nothing for the worker to
      // redo — punching again would only create a second exception.
      if (
        punchResult.faceMatchResult === 'exception' ||
        punchResult.geofenceResult === 'exception'
      ) {
        setNotice(MESSAGES.punchExceptionFlagged);
      } else {
        setNotice(null);
      }
      queryClient.invalidateQueries({ queryKey: ['my', 'attendance'] });
    },
    onError: (err: unknown) => {
      setPendingType(null);
      if (err instanceof ApiError && err.status === HTTP_LOCKED) {
        setIsLocked(true);
        setError(MESSAGES.payrollLocked);
        return;
      }
      setError(err instanceof Error ? err.message : MESSAGES.saveFailed);
    },
  });

  function startPunch(type: 'in' | 'out') {
    setError(null);
    setNotice(null);
    setQueuedNotice(false);
    setPendingType(type);
  }

  if (enrolment && enrolment.status === 'not_enrolled') {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-800">
        {MESSAGES.notEnrolled}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-white p-6 text-center shadow-sm">
        <p
          className="text-4xl font-semibold tabular-nums text-gray-900"
          aria-live="off"
        >
          {displayTime}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          ['In time', timeOnly(todayRow?.inTime ?? null)],
          ['Out time', timeOnly(todayRow?.outTime ?? null)],
          ['OT hours', todayRow?.otHours != null ? `${todayRow.otHours}` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white p-3 text-center shadow-sm">
            <dt className="text-xs uppercase tracking-wide text-gray-500">
              {label}
            </dt>
            <dd className="mt-1 text-lg font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Proactive, not just reactive (T015): telling the worker the period is
          closed before they capture a photo beats letting them go through the
          whole flow to be refused at the end. */}
      {isLocked && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {MESSAGES.payrollLocked}
        </p>
      )}

      <FormError message={error} />

      {notice && (
        <p
          role="status"
          className={
            queuedNotice
              ? 'rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800'
              : 'rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800'
          }
        >
          {notice}
        </p>
      )}

      {pendingType ? (
        <CameraCapture
          captureLabel={`Confirm punch ${pendingType}`}
          disabled={punch.isPending}
          onCancel={() => setPendingType(null)}
          onCapture={(photo) => punch.mutate({ type: pendingType, photo })}
        />
      ) : (
        <Button
          type="button"
          onClick={() => startPunch(nextType)}
          // The double-tap guard (T018). `isPending` covers the whole capture →
          // geolocate → submit sequence, which on a slow connection is several
          // seconds of a button that would otherwise look tappable again.
          disabled={punch.isPending}
          className="h-14 w-full justify-center text-base"
        >
          {punch.isPending
            ? 'Recording…'
            : nextType === 'in'
              ? 'Punch In'
              : 'Punch Out'}
        </Button>
      )}
    </div>
  );
}
