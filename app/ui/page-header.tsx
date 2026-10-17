import { ChevronRightIcon } from '@heroicons/react/20/solid';
import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';

import AreaChip from '@/app/ui/area-chip';
import { lusitana } from '@/app/ui/fonts';

/**
 * The heading block every screen in the shell opens with: a title, an optional line
 * of explanation, and optional actions aligned to the right of it.
 *
 * Shared because the app had grown two competing heading conventions — the serif
 * `lusitana` `text-2xl` most screens used, and a sans `text-xl font-semibold
 * text-gray-900` the newer modules used — plus four different bottom margins and two
 * different greys for the description. Nothing was wrong with any one of them; the
 * problem was that moving between two modules changed the typeface. The serif wins
 * here because it is what the sidebar wordmark and the login screen already use, so
 * it is the app's voice rather than one module's preference.
 *
 * Deliberately carries no margin of its own: a page that lays itself out with
 * `flex flex-col gap-6` would then have two spacings stacked. Call sites that need
 * one pass it through `className`.
 *
 * **The module's icon, in the module's colour, beside the title** (2026-10-14 colour pass).
 * Read from the route rather than passed in, so all hundred-odd screens got it without one of
 * them changing, and so it cannot disagree with the sidebar: both resolve the module by the same
 * longest-prefix rule (`areaForPath`). A path no module claims simply gets no chip.
 */
/** One step above the current page in a breadcrumb trail. */
export interface Crumb {
  label: ReactNode;
  href: string;
}

/**
 * The trail above a detail page's title (036 A23): "Plant › Equipment", then the machine's name as
 * the heading. It replaces the ~25 hand-built "Back to the register" / "← Purchase orders" links,
 * which sat in four different places with four different looks, and says where the page sits as
 * well as how to leave it. Only the ancestors are links — the heading below is the current page,
 * so it is not repeated here.
 */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-600">
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-1">
            <Link
              href={item.href}
              className="rounded hover:text-brand-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              {item.label}
            </Link>
            <ChevronRightIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
}: {
  title: ReactNode;
  /** One line on what the screen is for. Omitted where the title says it all. */
  description?: ReactNode;
  /** Buttons or controls belonging to the screen as a whole, not to its content. */
  actions?: ReactNode;
  /** The pages above this one, outermost first — for a detail page (036 A23). */
  breadcrumbs?: readonly Crumb[];
  className?: string;
}) {
  const header = (
    <div
      className={clsx(
        'flex flex-wrap items-start justify-between gap-x-4 gap-y-3',
        !breadcrumbs && className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <AreaChip className="mt-0.5 hidden h-10 w-10 rounded-xl sm:flex" />
        <div className="min-w-0">
          <h1
            className={`${lusitana.className} text-xl text-gray-900 md:text-2xl`}
          >
            {title}
          </h1>
          {description ? (
            <div className="mt-1 text-sm text-gray-600">{description}</div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
  if (!breadcrumbs?.length) return header;
  return (
    <div className={className}>
      <Breadcrumbs items={breadcrumbs} />
      {header}
    </div>
  );
}
