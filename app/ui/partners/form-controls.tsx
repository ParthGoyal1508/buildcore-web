'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

import { fieldClass, selectClass } from '@/app/ui/settings/form-fields';

/**
 * Form controls that work with `react-hook-form`'s `register()`.
 *
 * The Settings `form-fields.tsx` controls are fully controlled (`value` + `onChange`),
 * which is right for the small `useState` forms there but fights `register`'s
 * uncontrolled model. Rather than convert those and touch every screen that uses
 * them, this feature's forms get controls shaped for the library they use.
 *
 * Only the *wiring* differs, so only the wiring is duplicated: the boxes come from
 * `form-fields.tsx`. They used to be a second constant here with its own border grey
 * and its own placeholder grey, which is why a Partners form and a Settings form
 * beside it were subtly different shades of the same field — and why the select here
 * had the same chevron-over-the-text problem, since it was wearing a text input's
 * padding.
 */

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({
  id,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return <input id={id} className={clsx(fieldClass, className)} {...rest} />;
}

export function SelectInput({
  id,
  children,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string }) {
  return (
    <select id={id} className={clsx(selectClass, className)} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({
  id,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }) {
  return <textarea id={id} rows={3} className={clsx(fieldClass, className)} {...rest} />;
}
