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
} as const satisfies Record<PunchRefusalCode, string>;

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
 * The instruction for a refusal code.
 *
 * Takes the server's message as a fallback for one case only: a code this client does not know,
 * which can happen when the backend adds a reason before this list is updated. Saying the server's
 * sentence then is better than saying nothing — but it is the exception, and the type system makes
 * it an exception rather than the normal path.
 */
export function punchRefusalMessage(
  code: string | undefined,
  serverMessage?: string,
): string {
  if (isPunchRefusal(code)) return MESSAGE_BY_CODE[code];
  return serverMessage?.trim() || MESSAGES.saveFailed;
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
} as const satisfies Record<PunchRefusalReason, PunchRefusalCode>;

/** What a past refusal is called in a list the worker reads. */
export function punchRefusalReasonMessage(reason: PunchRefusalReason): string {
  return punchRefusalMessage(CODE_BY_REASON[reason]);
}

/** True where the refusal was about the photo, which is where "no photo is kept" applies. */
export function isFaceRefusal(reason: PunchRefusalReason): boolean {
  return CODE_BY_REASON[reason] === 'PUNCH_REFUSED_FACE';
}
