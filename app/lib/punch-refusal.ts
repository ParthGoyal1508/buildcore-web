import type { PunchRefusalReason } from '@/app/lib/api/my-workspace';
import {
  MESSAGES,
  PUNCH_REFUSAL_CODES,
  type PunchRefusalCode,
} from '@/app/lib/constants';

/**
 * What a worker is told when a punch is refused (020 FR-013a, T016).
 *
 * A pure function over a closed union, not a chain of conditionals inside the punch component.
 * This is the one place three distinct refusals become three distinct instructions, and it is
 * worth reading as a set — the moment two of them start saying the same thing, the merge is
 * visible here and nowhere else.
 *
 * **The server's own prose is never rendered as the whole message** (T017). The backend sends a
 * perfectly good sentence, and using it would still be wrong: a client that renders whatever
 * arrives cannot be reviewed, cannot be translated, and silently inherits any future wording
 * change — including one that collapses the two location refusals into a single "could not verify
 * your location", which is exactly the failure FR-014 exists to prevent.
 */

const MESSAGE_BY_CODE = {
  PUNCH_REFUSED_LOCATION: MESSAGES.punchRefusedLocation,
  PUNCH_REFUSED_UNLOCATABLE: MESSAGES.punchRefusedUnlocatable,
  PUNCH_REFUSED_FACE: MESSAGES.punchRefusedFace,
  PUNCH_REFUSED_LIVENESS: MESSAGES.punchRefusedLiveness,
} as const satisfies Record<PunchRefusalCode, string>;

/**
 * Which liveness check failed (057), worded for who is in front of the camera. Read from the 422's
 * `detail.liveness` — `{ kind, step }` — so the person is told the true reason: a head that did
 * not turn the way asked is what a held-up photo looks like, and saying so is the point.
 */
export function livenessRefusalMessage(
  details: Record<string, unknown> | undefined,
  subject: 'self' | 'other',
): string | null {
  const raw = (details?.detail as Record<string, unknown> | undefined)?.liveness;
  if (!raw || typeof raw !== 'object') return null;
  const { kind, step } = raw as { kind?: string; step?: string };
  const side = step === 'left' || step === 'right' ? step : null;
  const head = subject === 'self' ? 'your head' : 'their head';
  switch (kind) {
    case 'did_not_turn':
      return `The head did not turn${side ? ` to the ${side}` : ''} when asked, so this could not be confirmed as a live person — a photo held up to the camera looks exactly like this. Turn ${head} slowly when the screen says, then try again.`;
    case 'no_face':
      return `The face left the frame${side ? ` while turning ${side}` : ''}. Turn ${head} slowly, keeping the face inside the oval, then try again.`;
    case 'different_person':
      return 'The face changed between the photos, so this could not be confirmed as one live person. Keep the same face in the frame for the whole capture, then try again.';
    case 'spoof':
      return 'These photos look like a picture of a screen or a printout rather than a live face. The person must face the camera themselves, in good light — then try again.';
    default:
      return null;
  }
}

/**
 * Whether a code is one this client knows how to explain.
 *
 * Narrowed rather than cast. A punch can fail for reasons that are not refusals at all — a locked
 * payroll period, the day's pair already recorded — and those carry their own codes and their own
 * handling; treating any failure as a refusal would tell a worker to walk to the site when the
 * problem is that they already punched out.
 */
export function isPunchRefusal(code: string | undefined): code is PunchRefusalCode {
  return (
    code !== undefined &&
    (PUNCH_REFUSAL_CODES as readonly string[]).includes(code)
  );
}

/**
 * What the server measured when it refused (057): `details.detail` on the 422. Read defensively —
 * an older API sends none, and then the plain sentence is still right.
 */
export type RefusalMeasurement = {
  distanceMeters?: number;
  allowedMeters?: number;
  accuracyMeters?: number;
  accuracyMaxMeters?: number;
};

function measurementFrom(
  details: Record<string, unknown> | undefined,
): RefusalMeasurement {
  const raw = details?.detail;
  if (!raw || typeof raw !== 'object') return {};
  const pick = (key: keyof RefusalMeasurement) => {
    const value = (raw as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  };
  return {
    distanceMeters: pick('distanceMeters'),
    allowedMeters: pick('allowedMeters'),
    accuracyMeters: pick('accuracyMeters'),
    accuracyMaxMeters: pick('accuracyMaxMeters'),
  };
}

/** "850 m" under a kilometre (to the nearest 10 m — finer is false precision for GPS), "2.4 km" above. */
export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.max(10, Math.round(meters / 10) * 10)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * The measured half of a refusal (057): the numbers that justify it, in this client's own words.
 * Empty where the server sent nothing to quote. Shared by the employee and labour screens so a
 * distance reads the same on both.
 */
export function refusalMeasurementText(
  kind: 'location' | 'unlocatable' | 'face',
  details: Record<string, unknown> | undefined,
): string {
  const m = measurementFrom(details);
  if (
    kind === 'location' &&
    m.distanceMeters !== undefined &&
    m.allowedMeters !== undefined
  ) {
    return `You were about ${formatDistance(m.distanceMeters)} from the site; attendance is accepted within ${formatDistance(m.allowedMeters)}.`;
  }
  if (
    kind === 'unlocatable' &&
    m.accuracyMeters !== undefined &&
    m.accuracyMaxMeters !== undefined
  ) {
    return `Your phone placed you only within about ${Math.round(m.accuracyMeters)} m; attendance needs ${Math.round(m.accuracyMaxMeters)} m or better.`;
  }
  return '';
}

/**
 * The instruction for a refusal code.
 *
 * Takes the server's message as a fallback for one case only: a code this client does not know,
 * which can happen when the backend adds a reason before this list is updated. Saying the server's
 * sentence then is better than saying nothing — but it is the exception, and the type system makes
 * it an exception rather than the normal path.
 *
 * `details` is the 422's body (057). A face refusal with no face in the photo says so instead of
 * "did not match"; a location refusal leads with the measured distance or accuracy.
 */
export function punchRefusalMessage(
  code: string | undefined,
  serverMessage?: string,
  details?: Record<string, unknown>,
): string {
  if (!isPunchRefusal(code)) {
    return serverMessage?.trim() || MESSAGES.saveFailed;
  }
  if (
    code === 'PUNCH_REFUSED_FACE' &&
    details?.reason === 'no_face_detected'
  ) {
    return MESSAGES.punchRefusedNoFace;
  }
  if (code === 'PUNCH_REFUSED_LIVENESS') {
    return livenessRefusalMessage(details, 'self') ?? MESSAGE_BY_CODE[code];
  }
  // The measured sentence replaces the generic one rather than leading it — "you were 850 m away"
  // followed by "you are too far" says the same thing twice — and only the action follows.
  if (code === 'PUNCH_REFUSED_LOCATION') {
    const measured = refusalMeasurementText('location', details);
    if (measured) return `${measured} ${MESSAGES.punchRefusedLocationAction}`;
  }
  if (code === 'PUNCH_REFUSED_UNLOCATABLE') {
    const measured = refusalMeasurementText('unlocatable', details);
    if (measured) {
      return `${measured} ${MESSAGES.punchRefusedUnlocatableAction}`;
    }
  }
  return MESSAGE_BY_CODE[code];
}

/**
 * The reason enum the refusal *log* carries, mapped to the code the refusal *response* carries.
 *
 * Two vocabularies for one fact, and the asymmetry is in the backend by design: the response says
 * what to tell the worker (three codes), the log says what happened (four reasons). This is the one
 * place they meet, so the refused-attempts list and the punch screen cannot drift into explaining
 * the same refusal two different ways.
 */
const CODE_BY_REASON = {
  outside_geofence: 'PUNCH_REFUSED_LOCATION',
  unlocatable: 'PUNCH_REFUSED_UNLOCATABLE',
  face_mismatch: 'PUNCH_REFUSED_FACE',
  no_face_detected: 'PUNCH_REFUSED_FACE',
  liveness_failed: 'PUNCH_REFUSED_LIVENESS',
} as const satisfies Record<PunchRefusalReason, PunchRefusalCode>;

/** What a past refusal is called in a list the worker reads. */
export function punchRefusalReasonMessage(reason: PunchRefusalReason): string {
  return punchRefusalMessage(CODE_BY_REASON[reason], undefined, { reason });
}

/** True where the refusal was about the photo, which is where "no photo is kept" applies. */
export function isFaceRefusal(reason: PunchRefusalReason): boolean {
  return CODE_BY_REASON[reason] === 'PUNCH_REFUSED_FACE';
}
