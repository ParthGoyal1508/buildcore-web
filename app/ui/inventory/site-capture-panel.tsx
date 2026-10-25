'use client';

import { useQuery } from '@tanstack/react-query';

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
  // A data URL rather than an object URL, for the reason `company-logo.tsx` records: no lifecycle
  // to revoke, so nothing for strict mode's double effect to break.
  const photo = useQuery({
    queryKey: ['inventory', 'purchases', purchase.id, 'photo'],
    queryFn: async () =>
      blobToBase64((await getPurchasePhoto(purchase.id)).blob),
    enabled: Boolean(purchase.hasPhoto),
  });
  const history = useQuery({
    queryKey: ['inventory', 'purchases', purchase.id, 'history'],
    queryFn: () => getPurchaseHistory(purchase.id),
  });
  const photoUrl = photo.data ?? null;

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
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a fetched data URL
          <img
            src={photoUrl}
            alt="The delivery as photographed at the site"
            className="max-h-48 w-full rounded object-contain sm:w-40"
          />
        ) : (
          <div className="flex h-32 items-center justify-center rounded bg-gray-100 text-xs text-gray-500 sm:w-40">
            {photo.isPending && purchase.hasPhoto ? 'Loading photo…' : 'No photo'}
          </div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-gray-500">Delivered</dt>
          <dd>{dateTimeLabel(purchase.deliveredAt)}</dd>
          <dt className="text-gray-500">Vehicle no.</dt>
          <dd>{purchase.vehicleNo ?? '—'}</dd>
          <dt className="text-gray-500">Recorded by</dt>
          <dd>{purchase.createdByName ?? '—'}</dd>
          {gps && (
            <>
              <dt className="text-gray-500">Photo taken</dt>
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
