'use client';

import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  blobToBase64,
  createWorker,
  getMyLabourSites,
  type LabourGender,
  type Worker,
} from '@/app/lib/api/labour';
import {
  LABOUR_ATTENDANCE_COPY,
  LABOUR_ENROLMENT_PHOTOS,
  LABOUR_GENDER_LABELS,
  LABOUR_GENDERS,
  LABOUR_PUNCH_MESSAGES,
  MESSAGES,
  ROUTES,
} from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import FacePhotoPicker from '@/app/ui/labour/face-photo-picker';
import PageHeader from '@/app/ui/page-header';
import {
  FormError,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/** Ten digits, optionally after +91 / 0 — the same rule the API applies. */
const PHONE_PATTERN = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;

function registerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const code = error.code as keyof typeof LABOUR_PUNCH_MESSAGES | undefined;
    if (code && code in LABOUR_PUNCH_MESSAGES) return LABOUR_PUNCH_MESSAGES[code];
    if (error.status === 0) return LABOUR_ATTENDANCE_COPY.needsConnection;
    // Validation and no-face messages name the field or photo, which is what the supervisor
    // needs to fix it.
    if (error.status === 400 && error.message) return error.message;
  }
  return MESSAGES.saveFailed;
}

/**
 * Registering labour on site (031): name and gender, father's name and mobile if known, and 3–5
 * face photos. Everything goes in one request, so a labour is never left registered with no face
 * to match; the code (LAB-0001, LAB-0002…) is issued by the server.
 */
export default function RegisterLabourPage() {
  // `useSearchParams` needs a Suspense boundary to prerender.
  return (
    <Suspense
      fallback={
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      }
    >
      <RegisterLabourForm />
    </Suspense>
  );
}

function RegisterLabourForm() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });

  const [chosenSite, setChosenSite] = useState<string | null>(
    params.get('siteId'),
  );
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<LabourGender | ''>('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [touched, setTouched] = useState(false);
  const [registered, setRegistered] = useState<Worker | null>(null);

  // The site passed from the attendance screen, else the only one assigned.
  const siteId =
    chosenSite ?? (sites.data?.length === 1 ? sites.data[0].id : '');

  const errors = {
    siteId: !siteId ? 'Pick the site this labour works at.' : undefined,
    fullName: !fullName.trim() ? 'Enter the name.' : undefined,
    gender: !gender ? 'Pick male or female — it decides the daily rate.' : undefined,
    phone:
      phone.trim() && !PHONE_PATTERN.test(phone.trim())
        ? 'A mobile number is 10 digits, optionally starting with +91.'
        : undefined,
    photos:
      photos.length < LABOUR_ENROLMENT_PHOTOS.min
        ? `Take at least ${LABOUR_ENROLMENT_PHOTOS.min} photos.`
        : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);

  const register = useMutation({
    mutationFn: async () =>
      createWorker({
        siteId,
        fullName: fullName.trim(),
        gender: gender as LabourGender,
        ...(fatherName.trim() ? { fatherName: fatherName.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        photos: await Promise.all(photos.map((p) => blobToBase64(p))),
      }),
    onSuccess: (worker) => {
      setRegistered(worker);
      void queryClient.invalidateQueries({ queryKey: ['labour', 'today'] });
    },
  });

  const reset = () => {
    setFullName('');
    setGender('');
    setFatherName('');
    setPhone('');
    setPhotos([]);
    setTouched(false);
    setRegistered(null);
    register.reset();
  };

  if (sites.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (sites.isError) return <FormError message={MESSAGES.loadFailed} />;
  if (sites.data.length === 0) {
    return (
      <p className="rounded-md bg-gray-100 px-3 py-3 text-sm text-gray-700">
        {LABOUR_ATTENDANCE_COPY.noSites}
      </p>
    );
  }

  const attendanceHref = ROUTES.labourAttendance;

  if (registered) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-8 text-center"
        >
          <CheckCircleIcon className="w-10 text-green-600" aria-hidden="true" />
          <p className="text-base font-semibold text-gray-900">
            {registered.fullName} is registered
          </p>
          <p className="text-sm text-gray-700">
            Labour code{' '}
            <span className="font-mono font-semibold">{registered.labourCode}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="w-full justify-center" onClick={reset}>
            Register another
          </Button>
          <Link
            href={attendanceHref}
            className="flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm sm:h-10"
          >
            Back to attendance
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (valid) register.mutate();
      }}
    >
      <PageHeader
        title="Register Labour"
        description="The labour code is created automatically."
      />

      <FormError
        message={register.isError ? registerErrorMessage(register.error) : null}
      />

      {sites.data.length > 1 ? (
        <SelectField
          id="reg-site"
          label="Site"
          value={siteId}
          onChange={(e) => setChosenSite(e.target.value)}
          error={touched ? errors.siteId : undefined}
        >
          <option value="">Select a site…</option>
          {sites.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      ) : (
        <p className="text-sm text-gray-700">
          Site: <span className="font-medium">{sites.data[0].name}</span>
        </p>
      )}

      <TextField
        id="reg-name"
        label="Name"
        autoComplete="off"
        autoCapitalize="words"
        maxLength={120}
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={touched ? errors.fullName : undefined}
      />

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-gray-700">
          Gender
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {LABOUR_GENDERS.map((g) => (
            <label
              key={g}
              className={clsx(
                'flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-500',
                gender === g
                  ? 'border-brand-600 bg-brand-50 text-brand-800'
                  : 'border-gray-300 bg-white text-gray-700',
              )}
            >
              <input
                type="radio"
                name="gender"
                value={g}
                checked={gender === g}
                onChange={() => setGender(g)}
                className="sr-only"
              />
              {LABOUR_GENDER_LABELS[g]}
            </label>
          ))}
        </div>
        {touched && errors.gender && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {errors.gender}
          </p>
        )}
      </fieldset>

      <TextField
        id="reg-father"
        label="Father's name (optional)"
        autoComplete="off"
        autoCapitalize="words"
        maxLength={120}
        value={fatherName}
        onChange={(e) => setFatherName(e.target.value)}
      />

      <TextField
        id="reg-phone"
        label="Mobile number (optional)"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        maxLength={16}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        error={touched ? errors.phone : undefined}
      />

      <FacePhotoPicker
        photos={photos}
        onChange={setPhotos}
        error={touched ? errors.photos : undefined}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          className="w-full justify-center"
          disabled={register.isPending}
        >
          {register.isPending ? 'Registering…' : 'Register'}
        </Button>
        <Link
          href={attendanceHref}
          className="flex h-11 w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm sm:h-10"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
