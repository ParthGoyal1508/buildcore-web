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
import { isPunchRefusal, punchRefusalMessage } from '@/app/lib/punch-refusal';
import { resolvePosition, assertAccurate } from '@/app/lib/location';
import { Button } from '@/app/ui/button';
import { FormError } from '@/app/ui/settings/form-fields';
import CameraCapture from '@/app/ui/my/camera-capture';

/** HTTP 423 — the backend's status for a write into a closed payroll period. */
const HTTP_LOCKED = 423;

/**
 * Refusals in a row before the screen stops repeating itself and names a person (T019).
 *
 * Three: twice is ordinary — a cloud over the GPS, a badly lit photo — and by four the worker has
 * usually stopped reading. A named constant rather than a literal because it is a judgement about
 * people, not an implementation detail, and somebody will want to argue with it.
 */
const REFUSALS_BEFORE_ESCALATING = 3;

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
  /**
   * Whether the device has a connection, tracked rather than read at tap time (020 T011).
   *
   * Read during render, so it cannot be `navigator.onLine` directly: the server renders this
   * component and has no navigator, and seeding state from it during render would make the markup
   * disagree with the browser's. It starts optimistic — `true` — and the effect below corrects it
   * on mount. Optimistic rather than pessimistic because the wrong guess for one frame should be
   * "offer the punch", not "tell a worker with perfect signal they have none".
   */
  const [isOnline, setIsOnline] = useState(true);
  /**
   * The refusal to show, and how many have come in a row (020 FR-013, T018, T019).
   *
   * Held here rather than in `error` because a refusal is not an error in the sense that one is:
   * the request succeeded, the server understood it, and nothing is broken — the punch simply was
   * not accepted. It also needs two lines and a count, which `FormError` does not carry.
   *
   * The count is screen state and belongs nowhere else. No message in a table can know it is being
   * read for the third time, and a worker told the same sentence three times concludes the product
   * is stuck rather than that they should do something different.
   */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [refusalsInARow, setRefusalsInARow] = useState(0);
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

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    // Scheduled, not called in the effect body, for the reason the clock's first paint is:
    // writing state synchronously there forces an immediate second render pass, which
    // `react-hooks/set-state-in-effect` exists to prevent.
    const first = setTimeout(sync, 0);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      clearTimeout(first);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
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
      let coords: {
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
      };
      let usedFallback = false;
      try {
        const position = await getPosition();
        coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          // Sent so the backend can apply its accuracy allowance (020 FR-014a):
          // a punch counts as inside its fence when the distance falls within
          // `radius + accuracy`, which is what stops a worker standing on site
          // with a poor fix being refused for the device's uncertainty.
          //
          // `?? undefined` rather than a default: where the browser reports no
          // accuracy the field is **omitted**, never zeroed (FR-014b). Zero
          // asserts a perfect fix and would deny the worker the allowance.
          accuracyMeters: position.coords.accuracy ?? undefined,
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
        // No `accuracyMeters`, deliberately. The stand-in is a pair of coordinates
        // somebody configured, not a fix any device reported, and inventing an
        // accuracy for it would hand the backend a number with nothing behind it.
        coords = DEV_FALLBACK_POSITION;
        usedFallback = true;
      }
      usedFallbackRef.current = usedFallback;

      const input = { type, photo, capturedAt, ...coords };
      setPhase('submitting');

      /**
       * No queue (020 T008). A punch that cannot reach the server cannot be refused by it, and
       * under FR-013 a refusal has to arrive while the worker is still standing at the gate —
       * a queued punch delivered its refusal eight hours later, when nothing could be done.
       *
       * A network failure here surfaces as an error rather than being swallowed into a queue,
       * which is the same thing the screen now says before the attempt: punching needs a
       * connection. Nothing is lost that was not already lost, because the alternative was a
       * success the worker believed and the system later discarded.
       */
      return await submitPunch(input);
    },
    onSuccess: (punchResult: PunchResult) => {
      setPendingType(null);
      // The streak ends on anything that was accepted. A worker refused twice and then accepted is
      // not one attempt away from being told to find their supervisor.
      setRefusal(null);
      setRefusalsInARow(0);
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
      /**
       * A refused punch (020 FR-013). **This is the only place the worker learns what happened.**
       *
       * Under FR-013d nothing is written to attendance, so unlike every other failure on this
       * screen there is no record to go back to: the day will read as a day with no punch. The
       * refusal is shown here and listed under "Refused attempts"; it is deliberately absent from
       * the attendance view, which would recreate the refused day the backend refuses to keep.
       *
       * Branched on `code`, never on the message text — the convention this feature set, and the
       * reason the backend sends a code at all.
       */
      if (err instanceof ApiError && isPunchRefusal(err.code)) {
        setRefusal(punchRefusalMessage(err.code, err.message));
        setRefusalsInARow((count) => count + 1);
        queryClient.invalidateQueries({ queryKey: ['my', 'punch-refusals'] });
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
    // The previous refusal goes as soon as the worker acts on it. `refusalsInARow` deliberately
    // does not: it is the count of attempts, and resetting it here would mean the escalation could
    // never be reached, since every attempt starts by clearing what the last one said.
    setRefusal(null);
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

      {/* The refusal (020 FR-013, T018–T020).
          Amber rather than red, and separate from `FormError`: nothing is broken and nothing
          failed — a well-formed punch was not accepted, and the worker has something to do about
          it. Three parts, in the order they are useful: what to do, that nothing was recorded and
          who can fix that, and — only after three in a row — to stop and find a supervisor.

          No offer to show the photo (T020). A face refusal keeps none: an unattributed biometric
          held against a named employee is worse than the record it replaces. The line saying so is
          shown on a face refusal only, so it reads as a fact about this product rather than as an
          apology for a missing feature. */}
      {refusal && (
        <div
          role="alert"
          className="space-y-2 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-900"
        >
          <p className="font-medium">{refusal}</p>
          <p className="text-amber-800">{MESSAGES.punchRefusedRecovery}</p>
          {refusal === MESSAGES.punchRefusedFace && (
            <p className="text-amber-700">{MESSAGES.punchRefusedNoPhoto}</p>
          )}
          {refusalsInARow >= REFUSALS_BEFORE_ESCALATING && (
            <p className="font-medium">{MESSAGES.punchRefusedRepeatedly}</p>
          )}
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800"
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

      {/* No connection, no punch control (020 T011, T012).
          Stated before the capture rather than after it: a worker who photographs themselves,
          waits through the locate, and only then learns there is no signal has been made to do
          work for nothing. Styled as a condition — the amber of "punched in since", not the red
          of an error — because the application is not broken and must not look it. */}
      {!isOnline && !dayIsComplete && (
        <div className="space-y-2 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-800">
          <p role="status">{MESSAGES.punchNeedsConnection}</p>
          <p className="text-amber-700">
            {MESSAGES.punchNeedsConnectionRecovery}
          </p>
        </div>
      )}

      {/* Nothing to offer once the day's pair is recorded (FR-019c) — the boxes
          above already show what happened, and the only control that could appear
          here is one the server would refuse. */}
      {dayIsComplete || !isOnline ? null : pendingType ? (
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
