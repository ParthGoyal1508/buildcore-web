'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import clsx from 'clsx';
import { ApiError } from '@/app/lib/api/client';
import {
  completeReEnrolment,
  enrol,
  getEnrolmentStatus,
  requestReEnrolment,
  withdrawConsent,
  type FaceEnrolmentStatus,
} from '@/app/lib/api/my-workspace';
import {
  ENROLMENT_PHOTO_RANGE,
  MESSAGES,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import CameraCapture from '@/app/ui/my/camera-capture';

/** A captured shot plus the object URL its thumbnail is rendered from. */
interface Shot {
  blob: Blob;
  url: string;
}

const STATUS_LABEL: Record<FaceEnrolmentStatus['status'], string> = {
  not_enrolled: 'Not enrolled',
  enrolled: 'Enrolled',
  re_enrolment_requested: 'Re-enrolment requested',
};

const STATUS_CLASS: Record<FaceEnrolmentStatus['status'], string> = {
  not_enrolled: 'bg-gray-100 text-gray-700',
  enrolled: 'bg-green-100 text-green-800',
  re_enrolment_requested: 'bg-amber-100 text-amber-800',
};

/**
 * Face enrolment and re-enrolment (US1, US7).
 *
 * Both flows share one capture session — the difference between them is entirely
 * which endpoint the captured photos are sent to and what had to be true first, not
 * how the photos are taken.
 */
export default function FaceEnrolmentStatusPanel() {
  const queryClient = useQueryClient();

  const [shots, setShots] = useState<Shot[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [consentMethod, setConsentMethod] =
    useState<'signed_paper' | 'digital' | 'verbal'>('digital');
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'face-enrol'],
    queryFn: getEnrolmentStatus,
  });

  function resetCapture() {
    shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    setShots([]);
    setConsentAcknowledged(false);
    setIsCapturing(false);
    setFormError(null);
  }

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: ['my', 'face-enrol'] });
    resetCapture();
  };

  const asMessage = (error: unknown) =>
    error instanceof ApiError ? error.message : MESSAGES.saveFailed;

  const submitEnrolment = useMutation({
    mutationFn: () =>
      enrol({ photos: shots.map((s) => s.blob), consentMethod }),
    onSuccess: afterChange,
    onError: (error) => setFormError(asMessage(error)),
  });

  const submitReEnrolment = useMutation({
    mutationFn: () => completeReEnrolment({ photos: shots.map((s) => s.blob) }),
    onSuccess: afterChange,
    onError: (error) => setFormError(asMessage(error)),
  });

  const submitRequest = useMutation({
    mutationFn: () => requestReEnrolment(reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my', 'face-enrol'] });
      setReason('');
      setIsRequesting(false);
      setFormError(null);
    },
    onError: (error) => setFormError(asMessage(error)),
  });

  const withdraw = useMutation({
    mutationFn: withdrawConsent,
    onSuccess: afterChange,
    onError: (error) => setFormError(asMessage(error)),
  });

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }

  const reEnrolment = data.reEnrolment;
  const unlockActive = reEnrolment?.unlockActive === true;
  const isEnrolled = data.status === 'enrolled';
  const hasEnoughShots = shots.length >= ENROLMENT_PHOTO_RANGE.min;

  // A first enrolment needs consent recorded; a re-enrolment re-acknowledges it but
  // does not re-collect the method, because consent was given once and this is a
  // template replacement, not a new consent event.
  const canSubmitFirstEnrolment = hasEnoughShots && consentAcknowledged;
  const canSubmitReEnrolment = hasEnoughShots && consentAcknowledged;

  const captureSession = (
    <div className="space-y-4">
      {isCapturing ? (
        <CameraCapture
          // At the cap the button is disabled, so labelling it with the next
          // photo number advertises an action that can never happen — say why it
          // is unavailable instead.
          captureLabel={
            shots.length >= ENROLMENT_PHOTO_RANGE.max
              ? `Maximum ${ENROLMENT_PHOTO_RANGE.max} photos captured`
              : `Capture photo ${shots.length + 1}`
          }
          disabled={shots.length >= ENROLMENT_PHOTO_RANGE.max}
          onCancel={() => setIsCapturing(false)}
          onCapture={(blob) =>
            setShots((current) =>
              current.length >= ENROLMENT_PHOTO_RANGE.max
                ? current
                : [...current, { blob, url: URL.createObjectURL(blob) }],
            )
          }
        />
      ) : (
        <Button type="button" onClick={() => setIsCapturing(true)}>
          {shots.length === 0 ? 'Start capture' : 'Capture another'}
        </Button>
      )}

      <div>
        <p className="text-sm text-gray-700">
          {shots.length} of {ENROLMENT_PHOTO_RANGE.max} captured — at least{' '}
          {ENROLMENT_PHOTO_RANGE.min} needed.
        </p>
        {shots.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {shots.map((shot, index) => (
              <li key={shot.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`Captured photo ${index + 1}`}
                  className="h-20 w-20 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(shot.url);
                    setShots((current) =>
                      current.filter((s) => s.url !== shot.url),
                    );
                  }}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute -right-1 -top-1 rounded-full bg-gray-800 px-1.5 text-xs text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span
          className={clsx(
            'rounded-full px-3 py-1 text-sm font-medium',
            STATUS_CLASS[data.status],
          )}
        >
          {STATUS_LABEL[data.status]}
        </span>
        {data.enrolledAt && (
          <span className="text-sm text-gray-500">
            Since {new Date(data.enrolledAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <FormError message={formError} />

      {/* --- Not enrolled: the first-enrolment flow (US1). --- */}
      {data.status === 'not_enrolled' && (
        <section className="space-y-4">
          {captureSession}

          <SelectField
            id="consent-method"
            label="How was consent given?"
            value={consentMethod}
            onChange={(event) =>
              setConsentMethod(
                event.target.value as 'signed_paper' | 'digital' | 'verbal',
              )
            }
          >
            <option value="digital">Digitally, here</option>
            <option value="signed_paper">On a signed paper form</option>
            <option value="verbal">Verbally, recorded by HR</option>
          </SelectField>

          <CheckboxField
            id="consent-ack"
            label={MESSAGES.enrolmentConsent}
            checked={consentAcknowledged}
            onChange={(event) => setConsentAcknowledged(event.target.checked)}
          />

          <Button
            type="button"
            onClick={() => submitEnrolment.mutate()}
            disabled={!canSubmitFirstEnrolment || submitEnrolment.isPending}
          >
            {submitEnrolment.isPending ? 'Enrolling…' : 'Enrol'}
          </Button>
        </section>
      )}

      {/* --- Enrolled: capture is locked; re-enrolment is the only way in (FR-003,
             T012). Showing the capture flow here would offer an action the backend
             answers with a 409. --- */}
      {isEnrolled && !unlockActive && (
        <section className="space-y-4">
          <p className="text-sm text-gray-600">
            Your face is enrolled. To replace it — a beard, glasses, or repeated
            match failures — request a re-enrolment for approval.
          </p>

          {reEnrolment?.status === 'rejected' && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {MESSAGES.reEnrolmentRejected(reEnrolment.adminRemarks)}
            </p>
          )}
          {reEnrolment?.status === 'expired' && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {MESSAGES.reEnrolmentExpired}
            </p>
          )}

          {isRequesting ? (
            <div className="space-y-3">
              <TextField
                id="reenrol-reason"
                label="Why do you need to re-enrol?"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. My face is no longer being recognised"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => submitRequest.mutate()}
                  disabled={reason.trim().length === 0 || submitRequest.isPending}
                >
                  {submitRequest.isPending ? 'Sending…' : 'Send request'}
                </Button>
                <SecondaryButton
                  type="button"
                  onClick={() => setIsRequesting(false)}
                >
                  Cancel
                </SecondaryButton>
              </div>
            </div>
          ) : (
            <Button type="button" onClick={() => setIsRequesting(true)}>
              Request re-enrolment
            </Button>
          )}

          <div className="border-t border-gray-200 pt-4">
            <SecondaryButton
              type="button"
              onClick={() => withdraw.mutate()}
              disabled={withdraw.isPending}
              className="text-red-600"
            >
              {withdraw.isPending ? 'Withdrawing…' : 'Withdraw consent'}
            </SecondaryButton>
            <p className="mt-1 text-xs text-gray-500">
              Deletes your stored photos and face template. You will not be able
              to punch until you enrol again.
            </p>
          </div>
        </section>
      )}

      {/* --- Awaiting a decision (T037): no action to offer, so none is shown. --- */}
      {data.status === 're_enrolment_requested' && !unlockActive && (
        <section className="space-y-3">
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {MESSAGES.reEnrolmentPending}
          </p>
          <SecondaryButton
            type="button"
            onClick={() => withdraw.mutate()}
            disabled={withdraw.isPending}
            className="text-red-600"
          >
            Withdraw consent
          </SecondaryButton>
        </section>
      )}

      {/* --- Approved and still open: the one-time re-capture (T036). --- */}
      {unlockActive && (
        <section className="space-y-4">
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Re-enrolment approved. Capture fresh photos to replace your template
            {reEnrolment?.unlockExpiresAt && (
              <>
                {' '}
                — this approval expires{' '}
                {new Date(reEnrolment.unlockExpiresAt).toLocaleDateString()}
              </>
            )}
            .
          </p>

          {captureSession}

          <CheckboxField
            id="reenrol-consent-ack"
            label={MESSAGES.enrolmentConsent}
            checked={consentAcknowledged}
            onChange={(event) => setConsentAcknowledged(event.target.checked)}
          />

          <Button
            type="button"
            onClick={() => submitReEnrolment.mutate()}
            disabled={!canSubmitReEnrolment || submitReEnrolment.isPending}
          >
            {submitReEnrolment.isPending ? 'Replacing…' : 'Re-enrol now'}
          </Button>
        </section>
      )}
    </div>
  );
}
