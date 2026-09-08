'use client';

import clsx from 'clsx';

const FIELD_BOX =
  'rounded-md border border-gray-200 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:bg-gray-50 disabled:text-gray-500';

/** The box a text input, textarea or date field gets. Exported for the handful of
 *  screens that build their own labelled field rather than using `TextField`. */
export const fieldClass = `block w-full py-2 px-3 placeholder:text-gray-500 ${FIELD_BOX}`;

/**
 * The box a `<select>` gets, which is deliberately not the one a text input gets.
 *
 * The browser draws the chevron inside the field's own right padding, so a select
 * with the symmetric `px-3` an input uses paints it *over* the tail of the selected
 * option — plainly visible on the Site Dashboard, where "Select a site…" ran into
 * the arrow. `pr-9` reserves the room the arrow was always going to take.
 *
 * Exported because seven selects around the app were hand-rolled rather than built
 * from `SelectField`, and four of them had no width at all: a bare select is only as
 * wide as its widest option, so "PDF"/"Excel" collapsed to a stub while the field
 * beside it filled the row. This is the one dropdown box.
 */
export const selectClass = `block w-full py-2 pl-3 pr-9 ${FIELD_BOX}`;

/**
 * The same select sized to its content, for a toolbar or filter row rather than a
 * form column — a company switcher next to its label, an export format next to its
 * button. The floor is what stops those from shrinking to a stub; without a ceiling
 * on the options, a long site name is still allowed to make the control wider.
 */
export const inlineSelectClass = `block min-w-[10rem] py-2 pl-3 pr-9 ${FIELD_BOX}`;

/** A select inside a dense table cell, where a full-height field would grow the row. */
export const compactSelectClass = `block w-full py-1 pl-2 pr-7 ${FIELD_BOX}`;

/** A labelled text input. Native `<label htmlFor>` so clicking the label focuses the
 * field and screen readers announce it (spec FR-024). */
export function TextField({
  id,
  label,
  error,
  hint,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ');
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
        className={clsx(fieldClass, error && 'border-red-500')}
      />
      {hint && (
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

/** A labelled select. */
export function SelectField({
  id,
  label,
  error,
  hint,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  /** Added by 006, matching `TextField`: a disabled or constrained select needs to
   * say *why* under itself, not leave the reader to guess. */
  hint?: string;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ');
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
        className={clsx(selectClass, error && 'border-red-500')}
      >
        {children}
      </select>
      {hint && (
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

/** A labelled checkbox — a real `<input type="checkbox">`, not a styled div, so it
 * is focusable and toggles with Space out of the box. */
export function CheckboxField({
  id,
  label,
  description,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        {...rest}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      />
      <div>
        <label htmlFor={id} className="text-sm text-gray-700">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  );
}

/** Secondary action button, matching `app/ui/button.tsx`'s focus treatment. */
export function SecondaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx(
        'flex h-10 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Small inline action used in list rows. */
export function RowAction({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx(
        'rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Server-rejection banner shown at the top of a form, leaving entered data intact
 * (spec FR-022). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
