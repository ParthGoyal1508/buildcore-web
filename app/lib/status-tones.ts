/**
 * The five tones a status can carry (036 A21), and the classes each draws with.
 *
 * Every badge in the app used to pick its own pair of Tailwind colours — green-100/green-800 here,
 * emerald there, orange for one "needs attention" and amber for the next — 981 raw colour classes
 * against zero uses of the `success`/`warning`/`danger` tokens the config already defined. A status
 * now names what it *means* and the tone decides how that looks, so "late" is the same red on the
 * plant register and on the payroll run.
 *
 * - **success**: done and good — paid, approved, compliant, on site.
 * - **warning**: somebody owes an action — pending, due soon, returned, part-paid, in the workshop.
 * - **danger**: something is wrong or late — overdue, unpaid, missing, expired.
 * - **info**: known about, nothing wrong — submitted, verified, issued, allocated. The brand ramp,
 *   so an informational badge reads as the app's own colour rather than as a fifth hue.
 * - **neutral**: not yet real, or settled with nothing to do — draft, cancelled, rejected, closed.
 *
 * A module of its own, with no imports, so `app/lib/constants.ts` and the badge component can
 * both use it without importing each other.
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Fill and text for each tone. Text is the 800/900 shade on the 100 fill: ≥ 7:1 for every tone. */
export const TONE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-success-100 text-success-800',
  warning: 'bg-warning-100 text-warning-900',
  danger: 'bg-danger-100 text-danger-800',
  info: 'bg-info-100 text-info-800',
  neutral: 'bg-neutral-100 text-neutral-700',
};
