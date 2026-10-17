import clsx from 'clsx';

import { projectsLabel } from '@/app/lib/constants';

/**
 * The colour each status carries wherever it appears (008 FR-009, 004 FR-025).
 *
 * One map rather than a `clsx` ternary at each call site: a project shown as green
 * on the portfolio list and grey on its own page is the kind of inconsistency nobody
 * reports as a bug and everybody notices.
 *
 * Keyed by the raw enum value, not a label, so a rename in the copy cannot silently
 * detach a status from its colour. Values from more than one enum share this map
 * because they do not collide — and where they would (`draft` means one thing on a
 * DWR and another on an RA bill), they mean the same thing anyway: not yet real.
 */
const STATUS_STYLES: Record<string, string> = {
  // Project
  planning: 'bg-gray-100 text-gray-700',
  ongoing: 'bg-green-100 text-green-800',
  on_hold: 'bg-orange-100 text-orange-800',
  completed: 'bg-brand-100 text-brand-800',

  // Client and site
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-600',

  // Reminder severity (004 FR-025). Red for a breached date, amber for one about to
  // be, blue for merely known about — the three carry genuinely different urgency and
  // reusing the project palette's green here would say "fine" about something late.
  overdue: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-900',
  info: 'bg-brand-100 text-brand-800',

  // Bill payment status (009 FR-011). Red for money still owed, amber for part
  // settled, green for closed — the same three-step urgency the severities above
  // use, so a user reading two screens is not learning two colour languages.
  unpaid: 'bg-red-100 text-red-800',
  part_paid: 'bg-amber-100 text-amber-900',
  paid: 'bg-green-100 text-green-800',

  // Transfer movement status (009). `received` deliberately does NOT reuse the
  // green above: a received transfer is complete, but so is a paid bill, and the
  // two carry no relation. Blue reads as "done, nothing owed" rather than "good".
  pending: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-brand-100 text-brand-800',
  received: 'bg-green-100 text-green-800',

  // Asset outcome on a settlement summary (021 FR-018a). Three keys of its own rather than reusing
  // the bill-payment or urgency sets above, because none of them means this: an asset written off
  // is neither late nor paid, it is a decision somebody made and signed. Green for back on the
  // shelf, amber for written off — money the company lost, with a name against it — and red for
  // still held, which is the one that should stop a settlement.
  asset_returned: 'bg-green-100 text-green-800',
  asset_waived: 'bg-amber-100 text-amber-900',
  asset_held: 'bg-red-100 text-red-800',

  // Plant (006). `under_maintenance` is orange rather than red: a machine in the
  // workshop is not a failure, it is a machine being looked after — red belongs to
  // a service that is late. `inactive` reuses the grey above; a decommissioned
  // machine and a retired client mean the same thing.
  under_maintenance: 'bg-orange-100 text-orange-800',

  // Service schedule status (006 FR-006). `ok` is green, `due_soon` amber,
  // `overdue` red — reusing the `overdue` entry the reminder severities already
  // define, because a service past its reading and a certificate past its date
  // carry exactly the same urgency.
  ok: 'bg-green-100 text-green-800',
  due_soon: 'bg-amber-100 text-amber-900',

  // Maintenance job (006). `open` is amber because an open job means a machine is
  // down; `closed` is blue rather than green for the reason `received` is — the work
  // is finished, which is not the same as good news.
  open: 'bg-amber-100 text-amber-900',
  closed: 'bg-brand-100 text-brand-800',

  // Hire and service bill verification (006 FR-005, FR-021). Grey while nobody has
  // checked it, blue once someone has — `verified` is deliberately not green,
  // because a verified bill is still money owed and green would read as settled.
  // `paid` above already carries that.
  pending_verification: 'bg-gray-100 text-gray-700',
  verified: 'bg-brand-100 text-brand-800',
  partially_paid: 'bg-amber-100 text-amber-900',

  // Indent status (009 FR-025). `draft` and `submitted` are neutral — nobody has
  // decided yet. `rejected` and `cancelled` are grey rather than red: neither is a
  // problem to fix, they are both settled outcomes, and red would put an alarm on
  // every indent an approver correctly turned down.
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-brand-100 text-brand-800',
  // Bill packages (2026-10-13). Amber while an approver holds it — somebody specific owes a
  // decision — blue once issued (sent, money not yet agreed), green once certified.
  pending_approval: 'bg-amber-100 text-amber-900',
  issued: 'bg-brand-100 text-brand-800',
  certified: 'bg-green-100 text-green-800',
  abandoned: 'bg-gray-200 text-gray-700',
  approved: 'bg-green-100 text-green-800',
  // Returned for correction (028 — a daily work report, a muster). Amber rather than the grey
  // `draft` carries, and that difference is the point: a returned report is waiting on somebody
  // specific to do something specific, which a draft nobody has touched is not. Not red — being
  // sent back is the review working, not a failure.
  returned: 'bg-amber-100 text-amber-900',
  rejected: 'bg-gray-200 text-gray-700',
  partially_fulfilled: 'bg-amber-100 text-amber-900',
  fulfilled: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-200 text-gray-700',

  // Assets (012 FR-018). `idle` is green because an asset on the shelf is available,
  // which is the good state for a register — it is `allocated` that ties up capital.
  // `allocated` reuses the blue `in_transit` and `received` already carry: in use,
  // nothing wrong. `not_in_service` is grey — registered but not yet live, the same
  // "not yet real" the draft statuses above mean. `under_repair` is orange rather
  // than red for the reason `under_maintenance` is: a tool in the workshop is being
  // looked after. `scrapped` is red, and is the one asset state that is genuinely
  // terminal.
  not_in_service: 'bg-gray-100 text-gray-700',
  idle: 'bg-green-100 text-green-800',
  allocated: 'bg-brand-100 text-brand-800',
  under_repair: 'bg-orange-100 text-orange-800',
  scrapped: 'bg-red-100 text-red-800',
  // 2026-10-17: a machine sold — gone, but for money, so not alarming.
  sold: 'bg-slate-200 text-slate-800',
  closed_with_shortage: 'bg-amber-100 text-amber-900',
};

/** The style for a status nobody has assigned a colour to yet. Neutral rather than
 * alarming: an unrecognised value is a gap in this map, not a problem with the row. */
const FALLBACK_STYLE = 'bg-gray-100 text-gray-700';

/**
 * `label` overrides the displayed text without touching the colour lookup.
 *
 * Needed because `projectsLabel()` is the copy source for project statuses only —
 * reminder severities have their own wording (`REMINDER_SEVERITY_LABELS`), and
 * routing that through the projects copy map would either mislabel them or force
 * unrelated entries into it.
 */
export default function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  className?: string;
}) {
  if (!status) return <span className="text-sm text-gray-400">—</span>;

  return (
    <span
      className={clsx(
        // 2026-10-14 colour pass: a dot in the badge's own colour and a hairline inset ring.
        // The dot is what makes a column of statuses scannable by colour at a glance — the pale
        // fills alone were close enough to each other that amber and orange, or green and teal,
        // read as one — and the ring keeps a pale badge from dissolving into a tinted row.
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current before:opacity-70',
        STATUS_STYLES[status] ?? FALLBACK_STYLE,
        className,
      )}
    >
      {label ?? projectsLabel(status)}
    </span>
  );
}
