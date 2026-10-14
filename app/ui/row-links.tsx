'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * A table row that links somewhere opens on a click anywhere in it (2026-10-15).
 *
 * The client: "Wherever the table row is clickable, can we make the whole row clickable?" A row
 * already carries its way in — the employee's code, the project's name — as a real link, which is
 * what a keyboard, a screen reader and a middle-click use. This makes the rest of the row a larger
 * target for that same link rather than adding a second way to navigate: a click on the row's
 * empty space is passed to the row's first link, with the modifier keys, so Cmd/Ctrl-click still
 * opens a new tab.
 *
 * Left alone: a click on anything that does something of its own (a button, a field, another
 * link), anything in the actions cell (`data-row-actions`), a click that ends a text selection,
 * and any table marked `data-row-click="off"`. A row with no link is untouched.
 *
 * A row may instead name its destination in `data-row-href` (a list's `rowHref`), for lists whose
 * only link sits among the row's actions — Clients and Sites, where it was an Open button. The pointer cursor
 * that tells the reader a row opens is set in `global.css`, from the same rule.
 */
const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [data-row-actions], [contenteditable="true"]';

export default function RowLinks() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target as Element | null;
      if (!target || target.closest(INTERACTIVE)) return;
      // A table row, or a mobile card standing in for one.
      const row = target.closest('tbody tr, [data-row-href]');
      if (!row || row.closest('[data-row-click="off"]')) return;
      if (window.getSelection()?.toString()) return;
      const href = (row as HTMLElement).dataset.rowHref;
      if (href) {
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          window.open(href, '_blank', 'noopener');
          return;
        }
        // Told to the top loading bar, which otherwise learns of a navigation from the link
        // clicked — and here there is none.
        window.dispatchEvent(new CustomEvent('app:navigate'));
        router.push(href);
        return;
      }
      const link = Array.from(
        row.querySelectorAll<HTMLAnchorElement>('a[href]'),
      ).find((a) => !a.closest('[data-row-actions]'));
      if (!link) return;
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        }),
      );
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);
  return null;
}
