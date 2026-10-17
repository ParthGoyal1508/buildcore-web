'use client';

import clsx from 'clsx';
import { cloneElement, isValidElement, type ReactNode } from 'react';

import {
  FieldLabel,
  fieldClass,
  selectClass,
} from '@/app/ui/settings/form-fields';

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

/**
 * Puts the field's state on its control (036 A22): `aria-invalid` and `aria-describedby` from the
 * error and hint, `aria-required` from the marker. Only on a single element child, and never over a
 * value the call site set itself — a control wrapped in something else is left exactly as passed.
 */
function wire(children: ReactNode, aria: Record<string, unknown>) {
  if (!isValidElement<Record<string, unknown>>(children)) return children;
  const own = children.props;
  const extra = Object.fromEntries(
    Object.entries(aria).filter(([key, value]) => value !== undefined && own[key] === undefined),
  );
  return Object.keys(extra).length ? cloneElement(children, extra) : children;
}

export function Field({
  id,
  label,
  error,
  hint,
  required = false,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Shows the required marker and puts `aria-required` on the control (036 N2, A22). */
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      {wire(children, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby':
          [error && `${id}-error`, hint && !error && `${id}-hint`]
            .filter(Boolean)
            .join(' ') || undefined,
        'aria-required': required || undefined,
      })}
      {/* Ids `${id}-hint` / `${id}-error`, as `TextField` gives them, so the control can point
          `aria-describedby` at them (036 A22). */}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600" role="alert">
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
