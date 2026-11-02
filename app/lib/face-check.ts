'use client';

import type { FaceDetector } from '@mediapipe/tasks-vision';

/**
 * The on-device face check (057): MediaPipe's BlazeFace detector (Apache-2.0) run on the camera
 * preview, so a capture is taken the moment the face is in the oval and the head has actually
 * turned — instead of on a countdown the person may not keep up with — and "no face" is caught on
 * the phone before anything is uploaded.
 *
 * **Advisory only.** Every decision is the server's: this only times the frames and words the
 * hints. A client can be modified; the server's checks cannot be skipped from here.
 *
 * Served from this app (`/mediapipe/`, copied from the package at install), cached by the service
 * worker after the first download — about 5 MB compressed, once per phone.
 */

export interface FaceReading {
  found: boolean;
  /**
   * Head turn, measured exactly as the server measures it (`FaceAnalysis.yaw`): the nose's offset
   * from the midpoint between the eyes over the distance between them, on the unmirrored frame.
   * Rises as the person turns to **their** left.
   */
  yaw: number;
  /** Face box width over frame width — how close the face is. */
  size: number;
  /** Whether the face's centre is in the middle of the frame, where the oval is. */
  centred: boolean;
}

export interface FaceCheck {
  read(video: HTMLVideoElement): FaceReading;
}

const NO_FACE: FaceReading = { found: false, yaw: 0, size: 0, centred: false };

let loading: Promise<FaceCheck> | null = null;

/** Loads the detector once per page; a failed load is retried on the next call. */
export function loadFaceCheck(): Promise<FaceCheck> {
  loading ??= create().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function create(): Promise<FaceCheck> {
  const { FaceDetector, FilesetResolver } = await import(
    '@mediapipe/tasks-vision'
  );
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
  const detector: FaceDetector = await FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: '/mediapipe/blaze_face_short_range.tflite',
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.6,
  });
  let last = 0;
  return {
    read(video) {
      if (video.readyState < 2 || video.videoWidth === 0) return NO_FACE;
      // `detectForVideo` needs strictly increasing timestamps.
      last = Math.max(last + 1, performance.now());
      const { detections } = detector.detectForVideo(video, last);
      const best = detections
        .slice()
        .sort(
          (a, b) => (b.categories[0]?.score ?? 0) - (a.categories[0]?.score ?? 0),
        )[0];
      const points = best?.keypoints;
      if (!best?.boundingBox || !points || points.length < 3) return NO_FACE;
      // BlazeFace keypoints: the two eyes, then the nose tip (then mouth and ears).
      const [eyeA, eyeB, nose] = points;
      const between = Math.abs(eyeB.x - eyeA.x) || 1;
      const box = best.boundingBox;
      const centreX = (box.originX + box.width / 2) / video.videoWidth;
      const centreY = (box.originY + box.height / 2) / video.videoHeight;
      return {
        found: true,
        yaw: (nose.x - (eyeA.x + eyeB.x) / 2) / between,
        size: box.width / video.videoWidth,
        centred:
          Math.abs(centreX - 0.5) < 0.2 && Math.abs(centreY - 0.5) < 0.25,
      };
    },
  };
}
