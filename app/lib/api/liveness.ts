import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * Liveness captures (057): a face photo now proves a live person is in front of the camera by
 * turning their head the way a one-time, server-issued challenge asks. Every face capture —
 * punching, enrolling, registering labour — follows one.
 */

export type LivenessStep = 'straight' | 'left' | 'right';
export type LivenessFlow =
  | 'staff-punch'
  | 'labour-punch'
  | 'staff-enrolment'
  | 'labour-enrolment'
  // App Settings face unlock (054): registering the face, and using it in place of the password.
  | 'unlock-enrolment'
  | 'unlock-confirm';

const challengeSchema = z.object({
  challengeId: z.string(),
  steps: z.array(z.enum(['straight', 'left', 'right'])),
  expiresAt: z.string(),
});
export type LivenessChallenge = z.infer<typeof challengeSchema>;

/** A completed capture: the challenge it followed and one JPEG per step, in its order. */
export interface LivenessCaptureResult {
  challengeId: string;
  frames: Blob[];
}

/** A fresh challenge. Valid for two minutes and usable once — fetched as the capture starts. */
export async function issueLivenessChallenge(
  flow: LivenessFlow,
  workerId?: string,
): Promise<LivenessChallenge> {
  return challengeSchema.parse(
    await authFetch('/liveness/challenges', {
      method: 'POST',
      body: JSON.stringify({ flow, ...(workerId ? { workerId } : {}) }),
    }),
  );
}

/**
 * The multipart body a capture is submitted as: its fields as text, then the frames as `frames`,
 * in step order. Binary rather than base64 — a punch is three photos, and base64 would add a third
 * to each on site mobile data. Undefined fields are left out, never sent as "undefined".
 */
export function captureForm(
  capture: LivenessCaptureResult,
  fields: Record<string, string | number | boolean | null | undefined>,
): FormData {
  const form = new FormData();
  form.append('challengeId', capture.challengeId);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.append(key, String(value));
  }
  capture.frames.forEach((frame, i) =>
    form.append('frames', frame, `frame-${i + 1}.jpg`),
  );
  return form;
}
