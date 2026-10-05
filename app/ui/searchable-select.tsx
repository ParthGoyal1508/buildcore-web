'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SearchableOption {
  id: string;
  /** What identifies the row — a BOQ number, a code. Shown first and matched first. */
  label: string;
  /** The long text. Shown under the label, clamped, and matched on. */
  sublabel?: string;
  /** A short trailing note: a unit, a status. Matched on too. */
  note?: string;
}

/**
 * A select you can type into, over a list held in memory.
 *
 * ## Why this exists
 *
 * A native `<select>` is the right control for a handful of options and useless past about thirty.
 * The daily work form picks a BOQ line out of the project's schedule, and a real imported tender is
 * 231 lines whose descriptions run to forty words — so the native dropdown filled the screen, could
 * only be walked by first letter (and every one of those lines begins with a digit), and the
 * difference between `91.05` and `91.06` was two identical-looking rows a third of the way down.
 *
 * ## Matching
 *
 * Every typed word must appear somewhere in the row — number, description or unit — in any order.
 * Substring, not prefix: somebody looking for shuttering types *shutter*, and the word is nowhere
 * near the front of "Centering and Shuttering with plywood or steel sheets…". Requiring all words
 * is what makes a second word narrow rather than widen, which is how a person expects search to
 * behave.
 *
 * ## The empty choice is a row, not a blank
 *
 * "Not against a BOQ line" is a real answer here — a day can record work no schedule line covers —
 * so it is offered as an option rather than expressed by clearing the box, where it would be
 * indistinguishable from not having chosen yet.
 *
 * Follows the combobox pattern `dashboard-search.tsx` already established: one interaction model,
 * so the keys do the same thing in both places.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  emptyLabel,
  placeholder = 'Type to search',
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  options: SearchableOption[];
  /** Offered as the first row, selecting `''`. Omit to make a choice mandatory. */
  emptyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);

  const rows = useMemo<SearchableOption[]>(
    () =>
      emptyLabel ? [{ id: '', label: emptyLabel }, ...options] : [...options],
    [emptyLabel, options],
  );

  const matches = useMemo(() => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return rows;
    return rows.filter((row) => {
      // The empty choice always survives: it is an answer, and hiding it would make "no BOQ line"
      // reachable only by clearing a box the person has just typed into.
      if (row.id === '') return true;
      const hay =
        `${row.label} ${row.sublabel ?? ''} ${row.note ?? ''}`.toLowerCase();
      return words.every((word) => hay.includes(word));
    });
  }, [rows, term]);

  const selected = rows.find((row) => row.id === value);

  // Close on a click outside. `pointerdown` rather than `click` so a press that starts outside
  // closes before the control can steal focus back.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Keep the highlighted row on screen. With 231 options the keyboard walks straight off the
  // bottom of the panel otherwise, and the list looks frozen.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (row: SearchableOption) => {
    onChange(row.id);
    setTerm('');
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setTerm('');
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Prevented so the caret does not jump to either end of the box while the list is walked.
      event.preventDefault();
      if (matches.length === 0) return;
      setOpen(true);
      setActive((current) => {
        const from = Math.min(current, matches.length - 1);
        return event.key === 'ArrowDown'
          ? (from + 1) % matches.length
          : (from - 1 + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      // Always prevented while open: this control lives inside a form, and Enter on a highlighted
      // row would otherwise choose the row *and* submit the day.
      if (!open) return;
      event.preventDefault();
      const row = matches[active];
      if (row) choose(row);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[active] ? `${listboxId}-${active}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        // Closed, the box reads as the current choice; open, it is an empty search field. Showing
        // the selected text while searching would mean deleting it before every lookup.
        value={open ? term : (selected?.label ?? '')}
        placeholder={open ? placeholder : (emptyLabel ?? placeholder)}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-gray-300 px-3 py-2 disabled:bg-gray-100"
      />

      {/* Closed, the full description of the chosen line, which the single-line box cannot hold. */}
      {!open && selected?.sublabel && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
          {selected.sublabel}
          {selected.note ? ` (${selected.note})` : ''}
        </p>
      )}

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500" role="status">
              Nothing matches “{term}”.
            </li>
          ) : (
            matches.map((row, index) => (
              <li
                key={row.id || '(none)'}
                id={`${listboxId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={row.id === value}
                // `onMouseDown` rather than `onClick`: a click fires after blur, by which time the
                // outside-press handler has already closed the panel and the choice is lost.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(row);
                }}
                onMouseEnter={() => setActive(index)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === active ? 'bg-blue-50' : ''
                } ${row.id === value ? 'font-medium' : ''}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="shrink-0 tabular-nums">{row.label}</span>
                  {row.note && (
                    <span className="shrink-0 text-xs text-gray-500">
                      {row.note}
                    </span>
                  )}
                </span>
                {row.sublabel && (
                  <span className="mt-0.5 line-clamp-2 block text-xs text-gray-600">
                    {row.sublabel}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
