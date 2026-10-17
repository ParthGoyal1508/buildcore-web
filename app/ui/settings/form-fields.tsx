'use client';

import clsx from 'clsx';

/**
 * The box every field shares (2026-10-14 consistency pass).
 *
 * - **`border-gray-300`**, not 200: at 200 an empty input on the new tinted page ground was a
 *   barely-there outline, and a field you cannot see is a field nobody fills in.
 * - **`bg-white`** stated, so a field reads as a field on a tinted panel as well as a white one.
 * - **One focus treatment.** It used to be an offset outline *and* the forms plugin's own ring,
 *   drawn together — two concentric rectangles. Now the border itself turns accent with a
 *   one-pixel ring of the same colour, the convention every other control in the shell follows.
 */
const FIELD_BOX =
  'rounded-md border border-gray-300 bg-white text-sm text-gray-900 shadow-sm transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:bg-gray-50 disabled:text-gray-500';

/** The box a text input, textarea or date field gets. Exported for the handful of
 *  screens that build their own labelled field rather than using `TextField`. */
// `min-h-10`: 40px, the same as `Button` and `SecondaryButton` from `sm` up, so a field and the
// button beside it line up instead of differing by the 2px they used to.
export const fieldClass = `block min-h-10 w-full py-2 px-3 placeholder:text-gray-400 ${FIELD_BOX}`;

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
export const selectClass = `block min-h-10 w-full py-2 pl-3 pr-9 ${FIELD_BOX}`;

/**
 * The same select sized to its content, for a toolbar or filter row rather than a
 * form column — a company switcher next to its label, an export format next to its
 * button. The floor is what stops those from shrinking to a stub; without a ceiling
 * on the options, a long site name is still allowed to make the control wider.
 */
export const inlineSelectClass = `block min-h-10 min-w-[10rem] py-2 pl-3 pr-9 ${FIELD_BOX}`;

/** A select inside a dense table cell, where a full-height field would grow the row. */
export const compactSelectClass = `block w-full py-1 pl-2 pr-7 ${FIELD_BOX}`;

/**
 * A field's label, with the required marker built in (036 A22).
 *
 * The audit found required fields with no `*` and no `aria-required`, so the first a user heard of
 * a required field was the error after submitting. The asterisk is visual only — hidden from
 * assistive tech, because the control itself carries `aria-required` (and, where the form uses it,
 * the native `required`), which a screen reader already announces as "required". Saying it in the
 * label as well would announce it twice.
 */
export function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
      {label}
      {required && (
        <span className="ml-0.5 text-red-600" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

/** The ids a field's hint and error get, joined for `aria-describedby`. */
function describedBy(id: string, error?: string, hint?: string) {
  return (
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') ||
    undefined
  );
}

/** A labelled text input. Native `<label htmlFor>` so clicking the label focuses the
 * field and screen readers announce it (spec FR-024).
 *
 * `required` shows the marker and sets `aria-required`, and still reaches the input as the native
 * attribute, exactly as before. A react-hook-form field validated by its schema, where the browser's
 * own bubble is unwanted, passes `aria-required` alone and gets the marker all the same.
 *
 * `error` sets `aria-invalid` and is linked by `aria-describedby`, as is `hint` — so the message is
 * read with the field rather than only from a banner at the top of the form. */
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
  const required = isRequired(rest);
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        {...rest}
        className={clsx(fieldClass, error && 'border-red-500')}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}

/** `required`, or an explicit `aria-required` — either way the field gets its marker. */
function isRequired(props: {
  required?: boolean;
  'aria-required'?: boolean | 'true' | 'false';
}) {
  return (
    !!props.required ||
    props['aria-required'] === true ||
    props['aria-required'] === 'true'
  );
}

function FieldMessages({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string;
  hint?: string;
}) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-xs text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </>
  );
}

/**
 * Reserves the height of a field's label, so a bare control sits level with the inputs beside it.
 *
 * A row of fields aligned with `items-end` is thrown out by the first field that carries a hint:
 * the hint makes that column taller, bottom-aligning pushes that field's input *up*, and every
 * neighbouring label drops. Aligning the row to the top instead keeps the inputs on one line and
 * lets hints hang below where they belong — and then a button, which has no label, needs this to
 * land on that line rather than at the top of the row.
 *
 * A non-breaking space rather than a fixed height: it tracks whatever the label's type and spacing
 * are, so the two cannot drift apart.
 */
export function FieldLabelSpacer() {
  return (
    <span aria-hidden="true" className="mb-1 block text-sm font-medium">
      &nbsp;
    </span>
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
  const required = isRequired(rest);
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} required={required} />
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        {...rest}
        className={clsx(selectClass, error && 'border-red-500')}
      >
        {children}
      </select>
      <FieldMessages id={id} error={error} hint={hint} />
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
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-accent-500"
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

/**
 * The secondary and row-action buttons moved to `app/ui/button.tsx` with the rest of the button
 * variants (036 A21). Re-exported here so the ~200 imports from this module keep working.
 */
export { RowAction, RowActionLink, SecondaryButton } from '@/app/ui/button';

/** Server-rejection banner shown at the top of a form, leaving entered data intact
 * (spec FR-022). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
