'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  confirmFace,
  confirmPassword,
  enrolFaceUnlock,
  FACE_NOT_RECOGNISED,
  type FaceUnlockStatus,
  PASSWORD_INCORRECT,
  type PasswordConfirmation,
  removeFaceUnlock,
} from '@/app/lib/api/auth';
import type { LivenessCaptureResult } from '@/app/lib/api/liveness';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import { MESSAGES } from '@/app/lib/constants';
import { Button, SecondaryButton, TextButton } from '@/app/ui/button';
import LivenessCapture from '@/app/ui/attendance/liveness-capture';
import { FormError, TextField } from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { toast } from '@/app/ui/toast';

/**
 * Face unlock for App Settings (054, 2026-11-01): the client asked for the face in place of the
 * password, with the password kept as the fallback. The match runs on the server — this only
 * takes the pictures — and returns the same confirmation the password does.
 *
 * Both registering and confirming are the guided head-turn capture attendance uses (057), so a
 * photo of the owner held up to the camera is refused.
 *
 * The password is the settings password the server generates (`settings-password:rotate`), not
 * the sign-in password, and nothing here can show or change it.
 */

export const FACE_UNLOCK_QUERY = ['face-unlock', 'cash-visibility'] as const;

export type Confirmation = PasswordConfirmation & {
  method: 'password' | 'face';
};

/**
 * Asked at the moment of a protected change, not on opening the screen: the face when one is
 * registered (unless `passwordOnly`), the settings password otherwise or on request.
 */
export function ConfirmModal({
  faceEnrolled,
  passwordOnly = false,
  onConfirmed,
  onClose,
}: {
  faceEnrolled: boolean;
  passwordOnly?: boolean;
  onConfirmed: (confirmation: Confirmation) => void;
  onClose: () => void;
}) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const faceOffered = faceEnrolled && !passwordOnly;
  const faceGate = faceOffered && !usePassword;

  const confirm = useMutation({
    mutationFn: () => confirmPassword(password, 'cash-visibility'),
    onSuccess: (result) => onConfirmed({ ...result, method: 'password' }),
    onError: (err) => {
      setPassword('');
      setError(
        err instanceof ApiError && err.code === PASSWORD_INCORRECT
          ? 'That password is not correct.'
          : errorMessage(err, MESSAGES.saveFailed),
      );
    },
  });

  return (
    <Modal
      title="Confirm it's you"
      onClose={onClose}
      pending={confirm.isPending}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          {faceGate
            ? 'Look at the camera to save this setting.'
            : 'Enter the settings password to save this setting.'}
        </p>
        {faceGate ? (
          <FaceGate
            onConfirmed={(result) => onConfirmed({ ...result, method: 'face' })}
          />
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!password) return;
              setError(null);
              confirm.mutate();
            }}
          >
            <FormError message={error} />
            <TextField
              id="app-settings-password"
              label="Settings password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <div>
              <Button
                type="submit"
                intent="read"
                disabled={confirm.isPending || password.length === 0}
              >
                {confirm.isPending ? 'Checking…' : 'Confirm'}
              </Button>
            </div>
          </form>
        )}
        {faceOffered && (
          <TextButton
            onClick={() => {
              setError(null);
              setUsePassword((v) => !v);
            }}
          >
            {faceGate ? 'Use password instead' : 'Use face unlock instead'}
          </TextButton>
        )}
      </div>
    </Modal>
  );
}

/** The camera, in place of the password prompt: a guided head-turn capture (057). */
export function FaceGate({
  onConfirmed,
}: {
  onConfirmed: (confirmation: PasswordConfirmation) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  // A capture spends its challenge, so a refused one is retried with a fresh capture: remounted.
  const [attempt, setAttempt] = useState(0);
  const confirm = useMutation({
    mutationFn: (capture: LivenessCaptureResult) =>
      confirmFace(capture, 'cash-visibility'),
    onSuccess: (result) => {
      setError(null);
      onConfirmed(result);
    },
    onError: (err) => {
      setAttempt((n) => n + 1);
      setError(
        err instanceof ApiError &&
          (err.code === FACE_NOT_RECOGNISED || err.code === 'LIVENESS_FAILED')
          ? err.message
          : errorMessage(err, MESSAGES.saveFailed),
      );
    },
  });

  return (
    <div className="mt-4 flex flex-col gap-3">
      <FormError message={error} />
      {confirm.isPending ? (
        <p className="text-sm text-gray-600" role="status">
          Checking…
        </p>
      ) : (
        <LivenessCapture
          key={attempt}
          flow="unlock-confirm"
          subject="self"
          onCapture={(capture) => {
            setError(null);
            confirm.mutate(capture);
          }}
        />
      )}
    </div>
  );
}

/**
 * The table row that registers, replaces or removes the face. Each asks for the settings password
 * first — never the face, so a face that once passed cannot re-register itself.
 */
export function FaceUnlockRow({
  status,
  rowClass,
  cellClass,
}: {
  status: FaceUnlockStatus | undefined;
  rowClass: string;
  cellClass: string;
}) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<'enrol' | 'remove' | null>(null);
  const [enrolToken, setEnrolToken] = useState<string | null>(null);
  const enrolled = status?.enrolled ?? false;

  const remove = useMutation({
    mutationFn: (token: string) => removeFaceUnlock('cash-visibility', token),
    onSuccess: (next) => {
      queryClient.setQueryData(FACE_UNLOCK_QUERY, next);
      toast.success('Face unlock removed.');
    },
    onError: (err) => toast.error(errorMessage(err, MESSAGES.saveFailed)),
  });

  return (
    <tr className={rowClass}>
      <td className={cellClass}>
        <div className="font-medium text-gray-900">Face unlock</div>
        <div className="text-xs text-gray-500">
          Confirm secured settings with your face instead of a password.
        </div>
      </td>
      <td className={`${cellClass} text-gray-600`}>Security</td>
      <td className={`${cellClass} w-48`}>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            size="sm"
            disabled={!status}
            onClick={() => setAsking('enrol')}
          >
            {enrolled ? 'Update' : 'Set up'}
          </SecondaryButton>
          {enrolled && (
            <SecondaryButton
              type="button"
              size="sm"
              disabled={remove.isPending}
              onClick={() => setAsking('remove')}
            >
              Remove
            </SecondaryButton>
          )}
        </div>
        {asking && (
          <ConfirmModal
            faceEnrolled={enrolled}
            passwordOnly
            onClose={() => setAsking(null)}
            onConfirmed={(confirmation) => {
              if (asking === 'remove')
                remove.mutate(confirmation.confirmationToken);
              else setEnrolToken(confirmation.confirmationToken);
              setAsking(null);
            }}
          />
        )}
        {enrolToken && (
          <FaceEnrolModal
            confirmationToken={enrolToken}
            onClose={() => setEnrolToken(null)}
          />
        )}
      </td>
    </tr>
  );
}

function FaceEnrolModal({
  confirmationToken,
  onClose,
}: {
  confirmationToken: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Saved as soon as the capture completes: the guided capture is the whole of registering, so
  // there is no set of pictures left to review.
  const save = useMutation({
    mutationFn: (capture: LivenessCaptureResult) =>
      enrolFaceUnlock(capture, 'cash-visibility', confirmationToken),
    onSuccess: (next) => {
      queryClient.setQueryData(FACE_UNLOCK_QUERY, next);
      toast.success('Face unlock is set up.');
      onClose();
    },
    onError: (err) => {
      setAttempt((n) => n + 1);
      setError(errorMessage(err, MESSAGES.saveFailed));
    },
  });

  return (
    <Modal
      title="Set up face unlock"
      onClose={onClose}
      pending={save.isPending}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          Look at the camera in good light, press Start, and turn your head
          slightly when the screen asks.
        </p>
        <FormError message={error} />
        {save.isPending ? (
          <p className="text-sm text-gray-600" role="status">
            Saving…
          </p>
        ) : (
          <LivenessCapture
            key={attempt}
            flow="unlock-enrolment"
            subject="self"
            onCancel={onClose}
            onCapture={(capture) => {
              setError(null);
              save.mutate(capture);
            }}
          />
        )}
      </div>
    </Modal>
  );
}
