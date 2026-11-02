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
  type FaceEnrolmentStatus,
} from '@/app/lib/api/my-workspace';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import {
  CheckboxField,
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import LivenessCapture from '@/app/ui/attendance/liveness-capture';
import type { LivenessCaptureResult } from '@/app/lib/api/liveness';
import { LoadingText } from '@/app/ui/spinner';
import { dateLabel } from '@/app/lib/format';

/** A completed liveness capture (057), plus the object URL its straight frame is previewed from. */
interface Capture {
  result: LivenessCaptureResult;
  previewUrl: string;
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

  const [capture, setCapture] = useState<Capture | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my', 'face-enrol'],
    queryFn: getEnrolmentStatus,
  });

  function resetCapture() {
    if (capture) URL.revokeObjectURL(capture.previewUrl);
    setCapture(null);
    setConsentAcknowledged(false);
    setIsCapturing(false);
    setFormError(null);
  }

  function discardCapture() {
    if (capture) URL.revokeObjectURL(capture.previewUrl);
    setCapture(null);
  }

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: ['my', 'face-enrol'] });
    resetCapture();
  };

  const asMessage = (error: unknown) =>
    error instanceof ApiError ? error.message : MESSAGES.saveFailed;

  const submitEnrolment = useMutation({
    mutationFn: () =>
      // Consent is always given digitally here — the checkbox below is the record
      // of it, so there is no method left to choose.
      enrol({
        capture: (capture as Capture).result,
        consentMethod: 'digital',
      }),
    onSuccess: afterChange,
    // A refused capture is spent (its challenge is single-use), so it is cleared for a retake.
    onError: (error) => {
      setFormError(asMessage(error));
      discardCapture();
    },
  });

  const submitReEnrolment = useMutation({
    mutationFn: () =>
      completeReEnrolment({ capture: (capture as Capture).result }),
    onSuccess: afterChange,
    onError: (error) => {
      setFormError(asMessage(error));
      discardCapture();
    },
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

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
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
  const hasEnoughShots = capture !== null;

  // A first enrolment needs consent recorded; a re-enrolment re-acknowledges it but
  // does not re-collect the method, because consent was given once and this is a
  // template replacement, not a new consent event.
  const canSubmitFirstEnrolment = hasEnoughShots && consentAcknowledged;
  const canSubmitReEnrolment = hasEnoughShots && consentAcknowledged;

  // 057: one guided capture — look straight twice, then turn to each side as the screen asks —
  // in place of 3–5 separate photos. It proves a live person enrolled, and its slight turns give the
  // template the angles a punch is actually taken at.
  const captureSession = (
    <div className="space-y-4">
      {capture ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- an object URL */}
          <img
            src={capture.previewUrl}
            alt="Your captured face"
            className="h-20 w-20 rounded-md object-cover"
          />
          <div className="space-y-2">
            <p className="text-sm text-gray-700">Face captured.</p>
            <SecondaryButton type="button" onClick={discardCapture}>
              Retake
            </SecondaryButton>
          </div>
        </div>
      ) : isCapturing ? (
        <LivenessCapture
          flow="staff-enrolment"
          subject="self"
          onCancel={() => setIsCapturing(false)}
          onCapture={(result) => {
            setFormError(null);
            setIsCapturing(false);
            setCapture({
              result,
              previewUrl: URL.createObjectURL(result.frames[0]),
            });
          }}
        />
      ) : (
        <Button type="button" onClick={() => setIsCapturing(true)}>
          Start capture
        </Button>
      )}
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
            Since {dateLabel(data.enrolledAt)}
          </span>
        )}
      </div>

      <FormError message={formError} />

      {/* --- Not enrolled: the first-enrolment flow (US1). --- */}
      {data.status === 'not_enrolled' && (
        <section className="space-y-4">
          {captureSession}

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
                  disabled={
                    reason.trim().length === 0 || submitRequest.isPending
                  }
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
        </section>
      )}

      {/* --- Awaiting a decision (T037): no action to offer, so none is shown. --- */}
      {data.status === 're_enrolment_requested' && !unlockActive && (
        <section>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {MESSAGES.reEnrolmentPending}
          </p>
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
                {dateLabel(reEnrolment.unlockExpiresAt)}
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
