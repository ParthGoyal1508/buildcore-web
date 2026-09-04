'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/app/lib/api/client';
import {
  getAttendanceHistory,
  getTodayPunchState,
  submitPunch,
  type PunchResult,
  type TodayPunchState,
} from '@/app/lib/api/my-workspace';
import { getEnrolmentStatus } from '@/app/lib/api/my-workspace';
import { DEV_FALLBACK_POSITION, MESSAGES } from '@/app/lib/constants';
import { enqueue } from '@/app/lib/offline-queue';
import { resolvePosition, assertAccurate } from '@/app/lib/location';
import { Button } from '@/app/ui/button';
import { FormError } from '@/app/ui/settings/form-fields';
import CameraCapture from '@/app/ui/my/camera-capture';

/** HTTP 423 — the backend's status for a write into a closed payroll period. */
const HTTP_LOCKED = 423;

const two = (n: number) => String(n).padStart(2, '0');
const clockText = (date: Date) =>
  `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
const dateText = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
/**
 * Rendered until the clock starts on the client.
 *
 * Same character count as `clockText`, which with `tabular-nums` means the real
 * time replaces it without shifting the layout.
 */
const CLOCK_PLACEHOLDER = '--:--:--';
const timeOnly = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

/**
 * Reads the current position, rejecting a fix too vague to be worth sending
 * (research.md §4, spec FR-007).
 *
 * Acquisition and the accuracy gate both live in `app/lib/location.ts` now — the
 * single GPS implementation feature 013 reuses for the muster wizard (013 FR-006).
 * The punch flow's gate throws on a vague fix (`assertAccurate`); the muster flow
 * records the same fix and merely flags it.
 */
async function getPosition(): Promise<GeolocationPosition> {
  return assertAccurate(await resolvePosition());
}

export default function PunchClock() {
  const queryClient = useQueryClient();
  const now = new Date();

  const [pendingType, setPendingType] = useState<'in' | 'out' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [queuedNotice, setQueuedNotice] = useState(false);
  // Which step of the capture -> locate -> submit sequence is running. Locating can
  // take many seconds (and on a device that cannot get a fix, the better part of
  // half a minute before it gives up), during which the screen previously showed
  // nothing at all — indistinguishable from a button that had not registered the tap.
  const [phase, setPhase] = useState<'locating' | 'submitting' | null>(null);
  // A ref, not state: onSuccess needs to know whether the stand-in position was
  // used, and re-rendering mid-submit to carry that flag would be pointless work.
  const usedFallbackRef = useRef(false);

  // --- Server-synced clock (research.md §7). ---
  //
  // One offset, computed once, then ticked locally. Polling every second to display
  // a clock would be a network request per second for a cosmetic value; a grossly
  // wrong device clock is the only thing worth correcting, and one reading catches
  // that. The `capturedAt` actually submitted is a fresh device timestamp, which
  // the backend validates on its own terms regardless.
  const offsetRef = useRef(0);
  // Null until mounted, never seeded from `new Date()` during render. The server
  // renders this component too, and a clock initialised at render time produces
  // markup stamped with the server's time and locale that can never match what the
  // browser produces a moment later — React reports that as a hydration failure and
  // throws the whole tree away. The date below is held for the same reason: it is
  // formatted with the runtime's own locale and timezone, so server and client
  // disagree even when they agree on the day.
  const [displayTime, setDisplayTime] = useState<string | null>(null);
  const [displayDate, setDisplayDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const paint = () => {
      if (!active) return;
      const corrected = new Date(Date.now() + offsetRef.current);
      setDisplayTime(clockText(corrected));
      // Cheap, and keeps the date right for anyone on shift across midnight.
      setDisplayDate(dateText(corrected));
    };
    // Scheduled rather than called straight from the effect body: writing state
    // synchronously there triggers an immediate second render pass, which is what
    // `react-hooks/set-state-in-effect` exists to prevent. A zero-delay timer paints
    // on the next task instead — imperceptible, and it means the clock does not sit
    // on its placeholder for a full second waiting for the first interval tick.
    const firstPaint = setTimeout(paint, 0);

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

    const tick = setInterval(paint, 1000);
    return () => {
      active = false;
      clearTimeout(firstPaint);
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

  // Asked of the server rather than inferred from the attendance row. The backend
  // allows one punch-in and one punch-out a day (FR-008), and a screen guessing at
  // that offers actions the server then refuses.
  const { data: punchState } = useQuery({
    queryKey: ['my', 'punch-open'],
    queryFn: getTodayPunchState,
  });
  const hasOpenPunchIn =
    punchState?.punchedInAt != null && punchState.punchedOutAt == null;
  const nextType: 'in' | 'out' = hasOpenPunchIn ? 'out' : 'in';
  // No control at all once the day is done — not a disabled one. One pair is the
  // whole allowance, so anything offered past this point can only be refused, and
  // a disabled button still advertises a capability that does not exist.
  const dayIsComplete = punchState?.isComplete === true;

  const punch = useMutation({
    mutationFn: async ({ type, photo }: { type: 'in' | 'out'; photo: Blob }) => {
      const capturedAt = new Date().toISOString();

      setPhase('locating');
      let coords: { latitude: number; longitude: number };
      let usedFallback = false;
      try {
        const position = await getPosition();
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
      } catch (locationError) {
        // In production a punch without a real location is worthless — the whole
        // point is proving someone was on site — so the failure surfaces and the
        // punch stops here. In development it would instead make the screen
        // untestable on any machine whose OS will not hand out a position, so a
        // stand-in is used and announced.
        if (process.env.NODE_ENV === 'production') {
          throw locationError;
        }
        coords = DEV_FALLBACK_POSITION;
        usedFallback = true;
      }
      usedFallbackRef.current = usedFallback;

      const input = { type, photo, capturedAt, ...coords };
      setPhase('submitting');

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
        // Keep the stand-in-location warning visible on an otherwise clean punch —
        // it is the one thing about this record that is not real.
        setNotice(
          usedFallbackRef.current ? MESSAGES.locationDevFallback : null,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['my', 'attendance'] });
      // Written from the response rather than waiting on a refetch. The punch we
      // just made *is* the authoritative answer to "is there an open punch-in",
      // and depending on a round trip here left the button one tap behind reality:
      // a successful punch-out still showed "Punch Out", and the second tap was
      // refused with "You have no open punch-in to punch out from".
      queryClient.setQueryData(
        ['my', 'punch-open'],
        (previous: TodayPunchState | undefined) => ({
          punchedInAt:
            punchResult.type === 'in'
              ? punchResult.capturedAt
              : previous?.punchedInAt ?? null,
          punchedOutAt:
            punchResult.type === 'out'
              ? punchResult.capturedAt
              : previous?.punchedOutAt ?? null,
          isComplete: punchResult.type === 'out',
        }),
      );
    },
    onSettled: () => setPhase(null),
    onError: (err: unknown) => {
      setPendingType(null);
      // Whatever the server refused, our idea of the open punch-in may be what was
      // wrong — re-read it so the button corrects itself instead of offering the
      // same rejected action again.
      queryClient.invalidateQueries({ queryKey: ['my', 'punch-open'] });
      if (err instanceof ApiError && err.status === HTTP_LOCKED) {
        setIsLocked(true);
        setError(MESSAGES.payrollLocked);
        return;
      }
      // 409 is the day's own state refusing the punch (backend FR-008) — already
      // punched in, already punched out, nothing to punch out from. The server's
      // message says which, and is more useful than any generic copy here.
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
          {displayTime ?? CLOCK_PLACEHOLDER}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          {/* Non-breaking space holds the line's height before the date resolves. */}
          {displayDate ?? '\u00A0'}
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

      {hasOpenPunchIn && punchState?.punchedInAt && (
        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {MESSAGES.punchOpenSince(punchState.punchedInAt)}
        </p>
      )}

      {dayIsComplete && (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {MESSAGES.punchDayComplete}
        </p>
      )}

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

      {/* Locating can run for many seconds before it succeeds or gives up, and the
          capture button is disabled throughout. Without this the screen is
          indistinguishable from one that never registered the tap — which is
          exactly how it read. */}
      {phase && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
        >
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700"
          />
          {phase === 'locating'
            ? MESSAGES.punchLocating
            : MESSAGES.punchSubmitting}
        </p>
      )}

      {/* Nothing to offer once the day's pair is recorded (FR-019c) — the boxes
          above already show what happened, and the only control that could appear
          here is one the server would refuse. */}
      {dayIsComplete ? null : pendingType ? (
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
