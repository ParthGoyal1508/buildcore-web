'use client';

import { StarIcon, TruckIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  deleteEquipmentPhoto,
  getEquipmentPhotoDataUrl,
  getEquipmentPhotoFile,
  setMainEquipmentPhoto,
  uploadEquipmentPhoto,
  type EquipmentDetail,
} from '@/app/lib/api/plant';
import { dateLabel } from '@/app/lib/format';
import { confirmDialog } from '@/app/ui/dialogs';
import FileUpload from '@/app/ui/file-upload';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import { RowAction } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/** Photos only: the server refuses anything else (415). HEIC is converted by the browser where it can. */
const PHOTO_ACCEPT =
  'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
/** The gallery's limit, as the API enforces it. */
const MAX_PHOTOS = 20;

/**
 * A machine's photo, or the placeholder (036 K14).
 *
 * Loaded through the session as a data URL (the token never goes in a URL — see
 * `company-logo.tsx`) and cached by photo id for the session: a photo is never changed in place,
 * only replaced, so its id is its version. The placeholder shows while loading, when there is no
 * photo, and if the image cannot be fetched — a missing picture never breaks a row.
 */
export function EquipmentThumb({
  equipmentId,
  photoId,
  size = 'thumb',
  alt,
  className,
}: {
  equipmentId: string;
  photoId: string | null | undefined;
  size?: 'thumb' | 'full';
  alt: string;
  className?: string;
}) {
  const image = useQuery({
    queryKey: ['plant', 'equipment-photo', photoId, size],
    queryFn: () => getEquipmentPhotoDataUrl(equipmentId, photoId!, size),
    enabled: Boolean(photoId),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  if (photoId && image.data) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a data URL from an authenticated fetch; next/image cannot optimise it
      <img
        src={image.data}
        alt={alt}
        className={clsx('rounded-md bg-gray-100 object-cover', className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={photoId ? `${alt} (loading)` : `${alt}: no photo`}
      className={clsx(
        'flex items-center justify-center rounded-md bg-gray-100 text-gray-400',
        photoId && image.isPending && 'animate-pulse',
        className,
      )}
    >
      <TruckIcon className="h-1/2 max-h-10 w-1/2 max-w-10" aria-hidden="true" />
    </span>
  );
}

/**
 * The detail page's photos: the main one large, the gallery below, and an upload (036 K14).
 *
 * Optional throughout — a machine without photos shows the placeholder and the upload, nothing
 * more. Photos are shrunk in the browser before sending (FileUpload: ≤ 2048 px, WebP/JPEG) and
 * again on the server, which also makes the thumbnail. The first photo becomes the main one;
 * "Set as main" moves it; deleting the main one promotes the newest remaining.
 */
export function EquipmentPhotoGallery({
  equipment,
}: {
  equipment: EquipmentDetail;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { show, viewer } = useFileViewer();
  const [opening, setOpening] = useState<string | null>(null);
  const photos = equipment.photos;
  const main = photos.find((photo) => photo.isMain) ?? photos[0] ?? null;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['plant', 'equipment'] });

  const setMain = useMutation({
    mutationFn: (photoId: string) =>
      setMainEquipmentPhoto(equipment.id, photoId),
    onSuccess: () => {
      toast.success('Main photo changed.');
      void refresh();
    },
    onError: (err) =>
      toast.error(errorMessage(err, 'Could not change the main photo.')),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => deleteEquipmentPhoto(equipment.id, photoId),
    onSuccess: () => {
      toast.success('Photo deleted.');
      void refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not delete the photo.')),
  });

  async function open(photoId: string) {
    setOpening(photoId);
    try {
      show(
        await getEquipmentPhotoFile(equipment.id, photoId),
        `${equipment.code}-photo`,
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Could not open the photo.'));
    } finally {
      setOpening(null);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      {viewer}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Photos</h2>
        <p className="text-xs text-gray-500">
          Optional · {photos.length} of {MAX_PHOTOS}
        </p>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <button
          type="button"
          disabled={!main || opening === main?.id}
          onClick={() => main && void open(main.id)}
          className="block aspect-[4/3] w-full overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-default"
          aria-label={main ? 'Open the main photo' : 'No photo yet'}
        >
          <EquipmentThumb
            equipmentId={equipment.id}
            photoId={main?.id}
            alt={`${equipment.code} · ${equipment.name}`}
            className="h-full w-full"
          />
        </button>

        <div className="flex flex-col gap-3">
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {photos.map((photo) => (
                <li key={photo.id} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => void open(photo.id)}
                    disabled={opening === photo.id}
                    className={clsx(
                      'relative block aspect-square overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500',
                      photo.isMain && 'ring-2 ring-accent-500',
                    )}
                    aria-label={`Open photo${photo.fileName ? ` ${photo.fileName}` : ''}, added ${dateLabel(photo.uploadedAt)}`}
                  >
                    <EquipmentThumb
                      equipmentId={equipment.id}
                      photoId={photo.id}
                      alt={photo.fileName ?? 'Machine photo'}
                      className="h-full w-full"
                    />
                    {photo.isMain && (
                      <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-white/90 px-1 text-[11px] font-medium text-gray-800">
                        <StarSolidIcon className="h-3 w-3 text-amber-500" aria-hidden="true" />
                        Main
                      </span>
                    )}
                  </button>
                  <div className="flex flex-wrap justify-center gap-1">
                    {!photo.isMain && (
                      <RowAction
                        aria-label="Set as main photo"
                        title="Set as main photo"
                        loading={setMain.isPending && setMain.variables === photo.id}
                        onClick={() => setMain.mutate(photo.id)}
                      >
                        <StarIcon className="h-4 w-4" aria-hidden="true" />
                      </RowAction>
                    )}
                    <RowAction
                      loading={remove.isPending && remove.variables === photo.id}
                      onClick={async () => {
                        if (
                          await confirmDialog({
                            title: 'Delete this photo?',
                            message: photo.isMain
                              ? 'This is the main photo. The newest remaining photo becomes the main one.'
                              : 'The photo is removed from the gallery.',
                            confirmLabel: 'Delete',
                            tone: 'danger',
                          })
                        ) {
                          remove.mutate(photo.id);
                        }
                      }}
                    >
                      Delete
                    </RowAction>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {photos.length < MAX_PHOTOS ? (
            <FileUpload
              label={photos.length === 0 ? 'Add a photo' : 'Add another photo'}
              accept={PHOTO_ACCEPT}
              hint="JPEG, PNG or WebP, up to 10 MB. Shrunk before upload; the first photo becomes the main one."
              onUpload={(file) =>
                uploadEquipmentPhoto(equipment.id, {
                  file: file.base64,
                  fileName: file.fileName,
                })
              }
              onUploaded={() => {
                toast.success('Photo added.');
                void refresh();
              }}
            />
          ) : (
            <p className="text-xs text-gray-500">
              The gallery is full. Delete a photo to add another.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
