'use client';

import { CameraIcon, CheckCircleIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createSiteEntry,
  getSiteEntryItems,
  getSiteEntryStores,
  type SiteEntry,
} from '@/app/lib/api/inventory';
import { blobToBase64 } from '@/app/lib/api/labour';
import {
  DEV_FALLBACK_POSITION,
  MESSAGES,
  SITE_ENTRY_COPY,
  SITE_ENTRY_MESSAGES,
  SITE_ENTRY_RETAKE_CODES,
} from '@/app/lib/constants';
import { clockTime, dateLabel, todayIso } from '@/app/lib/format';
import { resolvePosition } from '@/app/lib/location';
import AsyncSelect, {
  type AsyncSearchPage,
  type SearchableOption,
} from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import { itemOption } from '@/app/ui/inventory/inventory-search';
import CameraCapture from '@/app/ui/my/camera-capture';
import PageHeader from '@/app/ui/page-header';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/** The photo as taken, with where and when the phone was at that moment. */
interface Capture {
  /** A data URL. */
  photo: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
}

/** Uppercase with every space removed — what the server stores, shown as it will be saved. */
const normaliseVehicleNo = (value: string) =>
  value.replace(/\s+/g, '').toUpperCase();

/** `HH:MM` on this phone's clock, for the time input's default. */
const nowTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/** The item picker reads the item master Head Office uses, through the site's own endpoint. */
function searchSiteItems(term: string): Promise<AsyncSearchPage> {
  return getSiteEntryItems(term || undefined).then((items) => ({
    items: items.map(itemOption),
    total: items.length,
  }));
}

/** The sentence for a refused or failed submit, by the API's code — never the server's prose. */
function entryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code as keyof typeof SITE_ENTRY_MESSAGES | undefined;
    if (code && code in SITE_ENTRY_MESSAGES) return SITE_ENTRY_MESSAGES[code];
    if (error.status === 0) return SITE_ENTRY_COPY.offline;
  }
  if (error instanceof Error && error.message) return error.message;
  return MESSAGES.saveFailed;
}

/**
 * Create Inventory Purchase (043): the site records a delivery as it arrives — store, item, when,
 * the vehicle and a live photo placed inside the site's geofence. It is saved partially filled and
 * moves no stock; Head Office completes it from the Purchases list.
 *
 * Create only: there is no list here, and the API offers this permission none.
 */
export default function SiteEntryPage() {
  const stores = useQuery({
    queryKey: ['inventory', 'site-entries', 'stores'],
    queryFn: getSiteEntryStores,
  });

  const [siteId, setSiteId] = useState('');
  const [itemId, setItemId] = useState('');
  const [item, setItem] = useState<SearchableOption | null>(null);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState(nowTime());
  const [vehicleNo, setVehicleNo] = useState('');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [camera, setCamera] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One id per entry, kept across retries: a double tap or a resubmit after the connection
  // dropped returns the entry already saved instead of recording the delivery twice.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [saved, setSaved] = useState<SiteEntry | null>(null);

  // With one store it is the store, read-only — the server would use it whatever was sent.
  const storeList = stores.data ?? [];
  const store =
    storeList.length === 1
      ? storeList[0]
      : storeList.find((s) => s.id === siteId);

  const deliveredAt = date && time ? new Date(`${date}T${time}`) : null;

  /** The photo, then the fix at that moment. No fix, no photo — the location is the point of it. */
  async function onPhoto(blob: Blob) {
    setCamera(false);
    setLocating(true);
    setError(null);
    try {
      let coords: { latitude: number; longitude: number; accuracy: number };
      try {
        coords = (await resolvePosition()).coords;
      } catch (e) {
        // A development build has no real fix to offer; production never falls back.
        if (process.env.NODE_ENV === 'production') throw e;
        coords = { ...DEV_FALLBACK_POSITION, accuracy: 10 };
      }
      setCapture({
        // The data URL is both the preview and what is sent — no object URL to revoke.
        photo: await blobToBase64(blob),
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: Math.round(coords.accuracy * 100) / 100,
        capturedAt: new Date().toISOString(),
      });
    } catch (e) {
      setCapture(null);
      setError(e instanceof Error ? e.message : MESSAGES.locationUnavailable);
    } finally {
      setLocating(false);
    }
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!capture || !deliveredAt) throw new Error(MESSAGES.saveFailed);
      return createSiteEntry({
        ...(storeList.length > 1 ? { siteId } : {}),
        itemId,
        deliveredAt: deliveredAt.toISOString(),
        vehicleNo: normaliseVehicleNo(vehicleNo),
        photo: capture.photo,
        latitude: capture.latitude,
        longitude: capture.longitude,
        accuracyMeters: capture.accuracyMeters,
        capturedAt: capture.capturedAt,
        clientRequestId: requestId,
      });
    },
    onSuccess: (entry) => setSaved(entry),
    onError: (e) => {
      setError(entryErrorMessage(e));
      // Refused for where or when the photo was taken: only a new photo can fix that.
      if (e instanceof ApiError && e.code && SITE_ENTRY_RETAKE_CODES.includes(e.code)) {
        setCapture(null);
      }
    },
  });

  function startAnother() {
    setSaved(null);
    setItemId('');
    setItem(null);
    setDate(todayIso());
    setTime(nowTime());
    setVehicleNo('');
    setCapture(null);
    setError(null);
    setRequestId(crypto.randomUUID());
    submit.reset();
  }

  if (stores.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (stores.isError) {
    return <FormError message={MESSAGES.loadFailed} />;
  }
  if (storeList.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={SITE_ENTRY_COPY.title} />
        <p
          role="alert"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {SITE_ENTRY_MESSAGES.SITE_ENTRY_NO_STORE}
        </p>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={SITE_ENTRY_COPY.title} />
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900"
        >
          <p className="flex items-center gap-2 font-medium">
            <CheckCircleIcon className="w-5" aria-hidden="true" />
            {SITE_ENTRY_COPY.saved}
          </p>
          <p>
            {saved.itemName} · {saved.siteName} · {saved.vehicleNo}
            <br />
            {dateLabel(saved.deliveredAt)} at {clockTime(saved.deliveredAt)} ·{' '}
            {saved.distanceMeters} m from the site centre
          </p>
        </div>
        <Button type="button" onClick={startAnother}>
          Record another delivery
        </Button>
      </div>
    );
  }

  const vehicle = normaliseVehicleNo(vehicleNo);
  const ready =
    Boolean(store) &&
    Boolean(itemId) &&
    Boolean(vehicle) &&
    Boolean(capture) &&
    Boolean(deliveredAt) &&
    !locating;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={SITE_ENTRY_COPY.title}
        description={SITE_ENTRY_COPY.description}
      />

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          // The button is disabled while sending; this catches a second Enter.
          if (!ready || submit.isPending) return;
          // Checked here rather than as the form renders: "now" is the moment of submitting.
          if (deliveredAt && deliveredAt.getTime() > Date.now() + 5 * 60_000) {
            setError('The delivery time cannot be in the future.');
            return;
          }
          setError(null);
          submit.mutate();
        }}
      >
        {storeList.length === 1 ? (
          <TextField
            id="site-entry-store"
            label="Store"
            value={storeList[0].name}
            readOnly
            disabled
            hint="Your assigned site."
          />
        ) : (
          <SelectField
            id="site-entry-store"
            label="Store"
            required
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
            hint="Only the sites assigned to you."
          >
            <option value="">Choose the store</option>
            {storeList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        )}

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="site-entry-item" className="font-medium text-gray-700">
            Item <span className="text-red-600">*</span>
          </label>
          <AsyncSelect
            id="site-entry-item"
            value={itemId}
            onChange={(id, option) => {
              setItemId(id);
              setItem(option);
            }}
            search={searchSiteItems}
            cacheKey={['inventory', 'site-entries', 'items']}
            selectedOption={item}
            placeholder="Search items by name or code"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="site-entry-date"
            label="Delivery date"
            type="date"
            required
            max={todayIso()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <TextField
            id="site-entry-time"
            label="Time"
            type="time"
            required
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>

        <TextField
          id="site-entry-vehicle"
          label="Vehicle number"
          required
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={30}
          value={vehicleNo}
          onChange={(event) => setVehicleNo(event.target.value)}
          hint={vehicle ? `Saved as ${vehicle}` : 'e.g. MH 12 AB 1234'}
        />

        <section className="flex flex-col gap-2" aria-labelledby="site-entry-photo">
          <h2 id="site-entry-photo" className="text-sm font-medium text-gray-700">
            Delivery photo <span className="text-red-600">*</span>
          </h2>
          <p className="text-xs text-gray-500">{SITE_ENTRY_COPY.photoHint}</p>

          {camera ? (
            <CameraCapture
              captureLabel="Take photo"
              onCancel={() => setCamera(false)}
              onCapture={(blob) => void onPhoto(blob)}
            />
          ) : locating ? (
            <p className="py-6 text-center text-sm" role="status">
              <LoadingText>{SITE_ENTRY_COPY.locating}</LoadingText>
            </p>
          ) : capture ? (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL */}
              <img
                src={capture.photo}
                alt="The delivery as photographed"
                className="max-h-64 w-full rounded-lg object-contain bg-gray-100"
              />
              <p className="flex items-center gap-1 text-xs text-gray-600">
                <MapPinIcon className="w-4" aria-hidden="true" />
                Location captured, accurate to about {Math.round(capture.accuracyMeters)} m
              </p>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setCapture(null);
                  setCamera(true);
                }}
                disabled={submit.isPending}
              >
                Retake photo
              </SecondaryButton>
            </div>
          ) : (
            <SecondaryButton type="button" onClick={() => setCamera(true)}>
              <CameraIcon className="mr-1 w-5" aria-hidden="true" />
              Take photo
            </SecondaryButton>
          )}
        </section>

        <FormError message={error} />

        <Button type="submit" disabled={!ready} loading={submit.isPending}>
          Submit
        </Button>
      </form>
    </div>
  );
}
