'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Form controls that work with `react-hook-form`'s `register()`.
 *
 * The Settings `form-fields.tsx` controls are fully controlled (`value` + `onChange`),
 * which is right for the small `useState` forms there but fights `register`'s
 * uncontrolled model. Rather than convert those and touch every screen that uses
 * them, this feature's forms get controls shaped for the library they use.
 */
const INPUT =
  'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:bg-gray-100 disabled:text-gray-500';

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
  return <input id={id} className={clsx(INPUT, className)} {...rest} />;
}

export function SelectInput({
  id,
  children,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { id: string }) {
  return (
    <select id={id} className={clsx(INPUT, className)} {...rest}>
      {children}
    </select>
  );
}

export function TextArea({
  id,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }) {
  return <textarea id={id} rows={3} className={clsx(INPUT, className)} {...rest} />;
}
