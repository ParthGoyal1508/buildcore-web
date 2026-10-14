'use client';

import clsx from 'clsx';
import Link from 'next/link';

import { formatRupees } from '@/app/lib/utils';

/**
 * A labelled figure with its icon — the tile the Group Dashboard's cards are built from, and
 * since 2026-10-15 the Overview's and the Site Dashboard's too (the client: "similar to Group
 * Dashboard, can we enhance the Overview and Site Dashboard as well?"). One tile, so the three
 * dashboards read as one product.
 */

/**
 * A rupee figure short enough for a card tile — ₹32.93 Cr, ₹8.85 L — with the exact amount
 * kept for the tooltip. Below a lakh the full figure already fits.
 */
export function compactRupees(value: number): string {
  const abs = Math.abs(value);
  const fixed = (n: number) =>
    n.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (abs >= 1e7) return `₹${fixed(value / 1e7)} Cr`;
  if (abs >= 1e5) return `₹${fixed(value / 1e5)} L`;
  return formatRupees(value);
}

export type Tone = 'default' | 'warning' | 'ok';

export interface Metric {
  key: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  value: string;
  /** The exact figure, where `value` is abbreviated. */
  title?: string;
  hint?: string;
  tone?: Tone;
  /** Spans both columns — the documents strip, which reads as a status line. */
  wide?: boolean;
  /** Where the tile goes on a click — the screen the figure comes from. */
  href?: string;
}

const TONE_ICON: Record<Tone, string> = {
  default: 'bg-accent-50 text-accent-700',
  warning: 'bg-amber-50 text-amber-700',
  ok: 'bg-emerald-50 text-emerald-700',
};

export function MetricTile({
  metric,
  inverted = false,
}: {
  metric: Metric;
  inverted?: boolean;
}) {
  const Icon = metric.icon;
  const tone = metric.tone ?? 'default';
  // Labels and hints wrap rather than truncate: "PF + ESIC (Sep 2026)" cut to "PF + ESIC
  // (S…" loses the month, which is the one thing that keeps the figure honest.
  return (
    <div
      className={clsx(
        'relative min-w-0 rounded-lg p-3 transition-colors',
        inverted ? 'bg-white/10' : 'bg-gray-50',
        metric.href &&
          (inverted
            ? 'hover:bg-white/20'
            : 'hover:bg-brand-50 hover:ring-1 hover:ring-brand-200'),
        metric.wide && 'col-span-2',
      )}
    >
      {/* A link laid over the whole tile rather than wrapping it: a `<dl>` admits only
          `<dt>`/`<dd>` groups in `<div>`s, so the tile stays a `<div>` and the link covers it. */}
      {metric.href && (
        <Link
          href={metric.href}
          aria-label={`${metric.label}: ${metric.value}`}
          className="absolute inset-0 z-10 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400"
        />
      )}
      <dt
        className={clsx(
          'flex items-start gap-2 text-xs font-medium leading-snug',
          inverted ? 'text-brand-100' : 'text-gray-500',
        )}
      >
        <span
          className={clsx(
            'grid h-6 w-6 shrink-0 place-items-center rounded-md',
            inverted ? 'bg-white/15 text-white' : TONE_ICON[tone],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="pt-1">{metric.label}</span>
      </dt>
      <dd
        className={clsx(
          'mt-1.5 truncate text-lg font-semibold tabular-nums',
          inverted
            ? // On the navy the tone shows in the figure itself, lighter so it reads.
              tone === 'warning'
              ? 'text-amber-300'
              : tone === 'ok'
                ? 'text-emerald-300'
                : 'text-white'
            : tone === 'warning'
              ? 'text-amber-800'
              : tone === 'ok'
                ? 'text-emerald-700'
                : 'text-gray-900',
        )}
        title={metric.title}
      >
        {metric.value}
      </dd>
      {metric.hint && (
        <dd
          className={clsx(
            'text-xs leading-snug',
            inverted ? 'text-brand-100/80' : 'text-gray-400',
          )}
        >
          {metric.hint}
        </dd>
      )}
    </div>
  );
}
