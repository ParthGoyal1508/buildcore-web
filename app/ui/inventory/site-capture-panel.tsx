'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getPurchaseHistory,
  getPurchasePhoto,
  type Purchase,
  type PurchaseHistoryEntry,
} from '@/app/lib/api/inventory';
import { blobToBase64 } from '@/app/lib/api/labour';
import { dateTimeLabel } from '@/app/lib/format';

/** Field names as the history shows them. */
const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  remarks: 'Remarks',
  itemId: 'Item',
  vehicleNo: 'Vehicle no.',
};

/**
 * "Vehicle no.: MH12AB1234 → MH12AB9999" for each field a correction changed. The item is stored
 * as an id, so it is only said to have changed.
 */
function changesOf(entry: PurchaseHistoryEntry): string[] {
  const before = entry.changes?.before ?? {};
  const after = entry.changes?.after ?? {};
  const show = (value: unknown) =>
    typeof value === 'string' ? value.slice(0, 30) : String(value ?? '—');
  return Object.keys(before)
    .filter((field) => field in FIELD_LABELS)
    .map((field) =>
      field === 'itemId'
        ? 'Item changed'
        : field === 'date'
          ? `Date: ${show(before.date).slice(0, 10)} → ${show(after.date).slice(0, 10)}`
          : `${FIELD_LABELS[field]}: ${show(before[field])} → ${show(after[field])}`,
    );
}

/**
 * What the site captured for a purchase it recorded (043) — the photo, where and when it was taken,
 * the vehicle and who recorded it — and every correction since. Read-only: the photo and the
 * location are evidence, and the history is the record of what was changed.
 */
export default function SiteCapturePanel({ purchase }: { purchase: Purchase }) {
  // Every photo the site took (up to five). Data URLs rather than object URLs, for the reason
  // `company-logo.tsx` records: no lifecycle to revoke, so nothing for strict mode to break.
  const count = purchase.photoCount ?? (purchase.hasPhoto ? 1 : 0);
  const photos = useQueries({
    queries: Array.from({ length: count }, (_, i) => ({
      queryKey: ['inventory', 'purchases', purchase.id, 'photo', i + 1],
      queryFn: async () =>
        blobToBase64((await getPurchasePhoto(purchase.id, i + 1)).blob),
    })),
  });
  const history = useQuery({
    queryKey: ['inventory', 'purchases', purchase.id, 'history'],
    queryFn: () => getPurchaseHistory(purchase.id),
  });
  // The photo shown large; the strip beneath picks it.
  const [shown, setShown] = useState(0);
  const shownUrl = photos[shown]?.data ?? null;

  const gps = purchase.gps;
  const corrections = (history.data ?? []).filter(
    (entry) => entry.action === 'UPDATE' && changesOf(entry).length > 0,
  );

  return (
    <section
      aria-labelledby="site-capture-title"
      className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm sm:col-span-2"
    >
      <h3 id="site-capture-title" className="font-medium text-gray-900">
        Recorded at the site
      </h3>
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <div className="flex flex-col gap-2">
          {shownUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a fetched data URL
            <img
              src={shownUrl}
              alt={`Delivery photo ${shown + 1} of ${count}`}
              className="h-40 w-full rounded bg-gray-100 object-contain"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
              {count > 0 ? 'Loading photo…' : 'No photo'}
            </div>
          )}
          {count > 1 && (
            <ul className="flex gap-1.5" aria-label="Delivery photos">
              {photos.map((photo, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setShown(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-pressed={shown === i}
                    className={`block h-10 w-10 overflow-hidden rounded border-2 bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 ${
                      shown === i ? 'border-brand-600' : 'border-transparent'
                    }`}
                  >
                    {photo.data && (
                      // eslint-disable-next-line @next/next/no-img-element -- a fetched data URL
                      <img
                        src={photo.data}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <dl className="grid content-start grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-gray-500">Delivered</dt>
          <dd>{dateTimeLabel(purchase.deliveredAt)}</dd>
          <dt className="text-gray-500">Vehicle no.</dt>
          <dd>{purchase.vehicleNo ?? '—'}</dd>
          <dt className="text-gray-500">Recorded by</dt>
          <dd>{purchase.createdByName ?? '—'}</dd>
          {gps && (
            <>
              <dt className="text-gray-500">First photo taken</dt>
              <dd>{dateTimeLabel(gps.capturedAt)}</dd>
              <dt className="text-gray-500">Location</dt>
              <dd>
                {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                {gps.accuracyMeters !== null &&
                  ` (±${Math.round(gps.accuracyMeters)} m)`}
              </dd>
              <dt className="text-gray-500">From site centre</dt>
              <dd>
                {gps.distanceMeters === null
                  ? '—'
                  : `${Math.round(gps.distanceMeters)} m`}
              </dd>
            </>
          )}
        </dl>
      </div>
      {corrections.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Changes
          </h4>
          <ul className="mt-1 space-y-1 text-xs text-gray-700">
            {corrections.map((entry) => (
              <li key={entry.at}>
                {dateTimeLabel(entry.at)} · {entry.byName ?? 'Someone'}:{' '}
                {changesOf(entry).join('; ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
