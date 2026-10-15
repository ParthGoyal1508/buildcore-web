/**
 * The one table look (2026-10-15), as plain class strings. A module of its own, without
 * `'use client'`, so a server component can use the classes too; `app/ui/table.tsx` re-exports it
 * beside the sorting.
 */
export const TABLE = {
  /**
   * The scrolling card a table sits in. `relative` (2026-10-15) makes it the containing block for
   * anything absolutely positioned inside the table — the `sr-only` "Actions" header above all. It
   * was otherwise placed against the page's content column, outside this box's clipping, and on a
   * phone dragged the whole page 200px sideways with the table's right edge (Reminders).
   */
  wrap: 'relative overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm',
  table: 'min-w-full text-sm text-gray-800',
  thead: 'border-b border-gray-200 bg-gray-50 text-left',
  th: 'px-3 py-3 align-bottom text-xs font-semibold text-gray-600',
  // `group/row` so a sticky cell can follow the row's hover; `stickyCell` gives it the same colour.
  row: 'group/row border-b border-gray-100 transition-colors last:border-0 hover:bg-brand-50/60',
  /** A cell pinned while the table scrolls sideways: opaque, so the rest does not show through it,
   * and the same tint as its row on hover (brand-50 at 60% over white, made opaque). */
  stickyCell:
    'sticky left-0 z-10 bg-white transition-colors group-hover/row:bg-[#f5fafd]',
  td: 'px-3 py-3 align-middle',
  tfoot: 'border-t-2 border-gray-200 bg-gray-50 font-semibold',
  /** Loading, empty and failed states, in the table's place. */
  empty:
    'rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500',
  failed: 'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700',
  /** A right-aligned figure column, digits lined up. */
  numeric: 'text-right tabular-nums',
} as const;
