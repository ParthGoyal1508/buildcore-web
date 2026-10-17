/**
 * After a submit that failed validation, put the keyboard on the first invalid field (036 A22).
 *
 * react-hook-form already focuses the first error itself (`shouldFocusError`) — but only a field
 * that is on screen. On a tabbed form the first error is often on a tab that is not showing, so
 * the library's focus went nowhere and the reader was left on a Save button that seemed to do
 * nothing. Call this from `handleSubmit`'s invalid callback *after* switching to the tab that holds
 * the error: it waits for that tab to render, then focuses the first control the form has marked
 * `aria-invalid` (which `TextField`, `SelectField` and the Partners `Field` all set), in DOM order.
 *
 * Two animation frames rather than one: the tab switch is a state update made after an `await`
 * inside `handleSubmit`, and the first frame can arrive before React has committed it.
 */
export function focusFirstInvalid(root: HTMLElement | null | undefined) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const field = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!field) return;
      field.focus();
      field.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }),
  );
}
