'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  confirmFace,
  enrolFaceUnlock,
  FACE_NOT_RECOGNISED,
  type FaceUnlockStatus,
  type PasswordConfirmation,
  removeFaceUnlock,
} from '@/app/lib/api/auth';
import { ApiError, errorMessage } from '@/app/lib/api/client';
import { ENROLMENT_PHOTO_RANGE, MESSAGES } from '@/app/lib/constants';
import { fileToBase64 } from '@/app/lib/files';
import { Button, IconButton, SecondaryButton } from '@/app/ui/button';
import CameraCapture from '@/app/ui/my/camera-capture';
import { FormError } from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { toast } from '@/app/ui/toast';

/**
 * Face unlock for App Settings (054, 2026-11-01): the client asked for the face in place of the
 * password, with the password kept as the fallback. The match runs on the server — this only
 * takes the picture — and returns the same confirmation the password does.
 */

export const FACE_UNLOCK_QUERY = ['face-unlock', 'cash-visibility'] as const;

/** The camera, in place of the password prompt. */
export function FaceGate({
  onConfirmed,
}: {
  onConfirmed: (confirmation: PasswordConfirmation) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const confirm = useMutation({
    mutationFn: async (photo: Blob) =>
      confirmFace(await fileToBase64(photo), 'cash-visibility'),
    onSuccess: (result) => {
      setError(null);
      onConfirmed(result);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError && err.code === FACE_NOT_RECOGNISED
          ? err.message
          : errorMessage(err, MESSAGES.saveFailed),
      ),
  });

  return (
    <div className="mt-4 flex flex-col gap-3">
      <FormError message={error} />
      <CameraCapture
        captureLabel={confirm.isPending ? 'Checking…' : 'Unlock with face'}
        disabled={confirm.isPending}
        onCapture={(blob) => {
          setError(null);
          confirm.mutate(blob);
        }}
      />
    </div>
  );
}

/** The table row that registers, replaces or removes the face. */
export function FaceUnlockRow({
  status,
  confirmation,
  rowClass,
  cellClass,
}: {
  status: FaceUnlockStatus | undefined;
  confirmation: PasswordConfirmation & { method: 'password' | 'face' };
  rowClass: string;
  cellClass: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const enrolled = status?.enrolled ?? false;
  // The API refuses a face confirmation here; say so before the camera opens, not after.
  const needsPassword = confirmation.method !== 'password';

  const remove = useMutation({
    mutationFn: () =>
      removeFaceUnlock('cash-visibility', confirmation.confirmationToken),
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
          {needsPassword
            ? 'Unlock this screen with your password to change it.'
            : 'Open this screen with your face instead of your password.'}
        </div>
      </td>
      <td className={`${cellClass} text-gray-600`}>Security</td>
      <td className={`${cellClass} w-48`}>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            size="sm"
            disabled={needsPassword || !status}
            onClick={() => setOpen(true)}
          >
            {enrolled ? 'Update' : 'Set up'}
          </SecondaryButton>
          {enrolled && (
            <SecondaryButton
              type="button"
              size="sm"
              disabled={needsPassword || remove.isPending}
              onClick={() => remove.mutate()}
            >
              Remove
            </SecondaryButton>
          )}
        </div>
        {open && (
          <FaceEnrolModal
            confirmationToken={confirmation.confirmationToken}
            onClose={() => setOpen(false)}
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
  const [shots, setShots] = useState<{ blob: Blob; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const full = shots.length >= ENROLMENT_PHOTO_RANGE.max;

  const save = useMutation({
    mutationFn: async () =>
      enrolFaceUnlock(
        await Promise.all(shots.map((s) => fileToBase64(s.blob))),
        'cash-visibility',
        confirmationToken,
      ),
    onSuccess: (next) => {
      queryClient.setQueryData(FACE_UNLOCK_QUERY, next);
      toast.success('Face unlock is set up.');
      onClose();
    },
    onError: (err) => setError(errorMessage(err, MESSAGES.saveFailed)),
  });

  return (
    <Modal
      title="Set up face unlock"
      onClose={onClose}
      isDirty={shots.length > 0}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="button"
            disabled={
              shots.length < ENROLMENT_PHOTO_RANGE.min || save.isPending
            }
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-600">
          Look at the camera in good light and take {ENROLMENT_PHOTO_RANGE.min}{' '}
          to {ENROLMENT_PHOTO_RANGE.max} pictures, turning your head slightly
          between them.
        </p>
        <FormError message={error} />
        <CameraCapture
          captureLabel={
            full
              ? `Maximum ${ENROLMENT_PHOTO_RANGE.max} pictures taken`
              : `Take picture ${shots.length + 1}`
          }
          disabled={full || save.isPending}
          onCapture={(blob) =>
            setShots((current) =>
              current.length >= ENROLMENT_PHOTO_RANGE.max
                ? current
                : [...current, { blob, url: URL.createObjectURL(blob) }],
            )
          }
        />
        {shots.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {shots.map((shot, index) => (
              <li key={shot.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`Picture ${index + 1}`}
                  className="h-16 w-16 rounded-md object-cover"
                />
                <IconButton
                  size="xs"
                  tone="overlay"
                  label={`Remove picture ${index + 1}`}
                  className="absolute -right-1 -top-1"
                  onClick={() => {
                    URL.revokeObjectURL(shot.url);
                    setShots((current) =>
                      current.filter((s) => s.url !== shot.url),
                    );
                  }}
                >
                  ×
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
