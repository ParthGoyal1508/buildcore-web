'use client';

import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/20/solid';
import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '@/app/lib/layers';

/**
 * The app's own popups for every native `<select>` and date field (2026-10-15).
 *
 * The client: "These dropdown, … date picker etc doesn't look good." A closed select or date field
 * is ours to style, and is; what opens from it is the operating system's — a grey macOS menu with
 * a tick, Chrome's calendar — and nothing in CSS reaches it.
 *
 * **Why one listener and not a component per field.** There are about a hundred selects and a
 * hundred date fields, most of them registered with react-hook-form, which holds a ref to the
 * native element and reads its value. Replacing each with a custom control would mean re-wiring
 * every form, and every label, `required`, error focus and reset with it. Instead the fields stay
 * native — focus, labels, validation and screen readers are untouched — and this takes over only
 * the popup: a pointer press or an opening key on a field shows ours in place of the browser's,
 * and a choice is written back to the field with the events a user's own choice would fire, so
 * React's `onChange` and react-hook-form see nothing different.
 *
 * **Fine pointers only.** On a phone the native pickers — the iOS wheel, Android's sheet — are
 * better than anything drawn in the page, so a touch device keeps them.
 *
 * Opt out with `data-native` on a field.
 */
export default function NativePickers() {
  const [select, setSelect] = useState<HTMLSelectElement | null>(null);
  const [date, setDate] = useState<HTMLInputElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const eligibleSelect = (target: EventTarget | null) => {
      if (!fine.matches || !(target instanceof HTMLSelectElement)) return null;
      if (target.multiple || target.size > 1 || target.disabled) return null;
      if (target.hasAttribute('data-native')) return null;
      return target;
    };
    const eligibleDate = (target: EventTarget | null) => {
      if (!fine.matches || !(target instanceof HTMLInputElement)) return null;
      if (
        (target.type !== 'date' && target.type !== 'month') ||
        target.disabled ||
        target.readOnly
      ) {
        return null;
      }
      if (target.hasAttribute('data-native')) return null;
      return target;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const el = eligibleSelect(event.target);
      if (el) {
        // The browser opens its own menu on this press; stopping it is the whole point.
        event.preventDefault();
        el.focus();
        setDate(null);
        setSelect((current) => (current === el ? null : el));
        return;
      }
      const field = eligibleDate(event.target);
      if (field) {
        // Not prevented: a click still places the caret in the day, month or year, so a date can
        // be typed as before. Only the calendar is ours.
        setSelect(null);
        setDate(field);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const el = eligibleSelect(event.target);
      if (
        el &&
        (event.key === 'ArrowDown' ||
          event.key === 'ArrowUp' ||
          event.key === ' ' ||
          event.key === 'Enter' ||
          event.key === 'F4')
      ) {
        // Handled by the open menu's own listener once it is open.
        if (el.hasAttribute('data-picker-open')) return;
        event.preventDefault();
        setDate(null);
        setSelect(el);
        return;
      }
      const field = eligibleDate(event.target);
      if (
        field &&
        ((event.altKey && event.key === 'ArrowDown') || event.key === 'F4')
      ) {
        event.preventDefault();
        setSelect(null);
        setDate(field);
      }
    };
    // Capture, so a field inside a dialog that stops propagation is still seen.
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  const closeSelect = useCallback(() => setSelect(null), []);
  const closeDate = useCallback(() => setDate(null), []);

  return (
    <>
      {select && (
        <SelectMenu key={uid(select)} el={select} onClose={closeSelect} />
      )}
      {date && <Calendar key={uid(date)} el={date} onClose={closeDate} />}
    </>
  );
}

const ids = new WeakMap<Element, number>();
let nextId = 1;
/** A stable key per element, so moving between two fields remounts the popup fresh. */
function uid(el: Element) {
  if (!ids.has(el)) ids.set(el, nextId++);
  return ids.get(el);
}

/** Writes a value the way a user's own choice would arrive: React and react-hook-form both hear it. */
function commit(el: HTMLSelectElement | HTMLInputElement, value: string) {
  if (el.value === value) return;
  // The prototype's setter, not `el.value =`: React tracks the last value it set on an input and
  // ignores an event whose value matches it, which an assignment through the element would fake.
  const proto =
    el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Where a popup goes: under its field, or above it when there is not room below. Fixed to the
 * viewport and portalled to the body, so a table's `overflow-x-auto` or a dialog's `overflow-hidden`
 * cannot clip it. Follows the field when anything scrolls.
 */
function usePlacement(
  el: HTMLElement,
  panel: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
  /** The select menu takes the field's width; the calendar keeps its own (`w-72`). */
  matchWidth = false,
) {
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    visibility: 'hidden',
  });
  const [above, setAbove] = useState(false);

  useLayoutEffect(() => {
    const place = () => {
      if (!el.isConnected) {
        onClose();
        return;
      }
      const rect = el.getBoundingClientRect();
      const height = panel.current?.offsetHeight ?? 0;
      const below = window.innerHeight - rect.bottom - 8;
      const flip = below < Math.min(height, 260) && rect.top > below;
      // Exactly the field's width, so the menu lines up under it; a long option wraps rather
      // than widening the menu past the field. A narrow field (a compact filter) still gets a
      // readable 10rem.
      const width = matchWidth
        ? Math.max(rect.width, 160)
        : (panel.current?.offsetWidth ?? 0);
      setAbove(flip);
      setStyle({
        position: 'fixed',
        left: Math.max(
          8,
          Math.min(
            rect.left,
            // From the width the panel *will* have (2026-10-15). Measured before that width
            // applied, a long option (a work order's full description) made the unconstrained
            // panel nearly screen-wide, and the menu opened two fields to the left of its own.
            window.innerWidth - 8 - width,
          ),
        ),
        ...(matchWidth ? { width } : {}),
        maxHeight: Math.max(160, (flip ? rect.top : below) - 8),
        ...(flip
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [el, panel, onClose, matchWidth]);

  // A press anywhere but the field and the popup closes it. The field's own press is handled by
  // the document listener above, which toggles.
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (el.contains(target) || panel.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [el, panel, onClose]);

  return { style, above };
}

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
  /** The `<optgroup>` label, set on the first option of each group only. */
  header: string | null;
  index: number;
}

function SelectMenu({
  el,
  onClose,
}: {
  el: HTMLSelectElement;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [choices] = useState<Choice[]>(() =>
    Array.from(el.options).map((option, index, all) => {
      const group = (o: HTMLOptionElement | undefined) =>
        o?.parentElement instanceof HTMLOptGroupElement
          ? o.parentElement.label
          : null;
      const mine = group(option);
      return {
        value: option.value,
        label: option.label || option.text,
        disabled: option.disabled,
        header: mine !== null && mine !== group(all[index - 1]) ? mine : null,
        index,
      };
    }),
  );
  const [active, setActive] = useState(() => Math.max(0, el.selectedIndex));
  const { style, above } = usePlacement(el, panel, onClose, true);
  const typed = useRef({ text: '', at: 0 });
  // A layer (036 A8): Escape closes this menu, never the modal the field sits in.
  useLayer(onClose);

  const choose = useCallback(
    (choice: Choice) => {
      if (choice.disabled) return;
      commit(el, choice.value);
      onClose();
      el.focus();
    },
    [el, onClose],
  );

  useEffect(() => {
    el.setAttribute('data-picker-open', 'true');
    el.setAttribute('aria-expanded', 'true');
    return () => {
      el.removeAttribute('data-picker-open');
      el.removeAttribute('aria-expanded');
    };
  }, [el]);

  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useEffect(() => {
    const step = (from: number, by: number) => {
      let next = from;
      for (let i = 0; i < choices.length; i++) {
        next = Math.min(choices.length - 1, Math.max(0, next + by));
        if (!choices[next]?.disabled) return next;
      }
      return from;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.target !== el) return;
      const handled = () => {
        event.preventDefault();
        event.stopPropagation();
      };
      switch (event.key) {
        case 'ArrowDown':
          handled();
          setActive((a) => step(a, 1));
          return;
        case 'ArrowUp':
          handled();
          setActive((a) => step(a, -1));
          return;
        case 'Home':
          handled();
          setActive(step(-1, 1));
          return;
        case 'End':
          handled();
          setActive(step(choices.length, -1));
          return;
        case 'Enter':
        case ' ':
          handled();
          if (choices[active]) choose(choices[active]);
          return;
        case 'Escape':
          handled();
          onClose();
          return;
        case 'Tab':
          onClose();
          return;
      }
      // Type-ahead: the first option starting with what has been typed in the last second.
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
        handled();
        const now = Date.now();
        typed.current = {
          text:
            (now - typed.current.at < 800 ? typed.current.text : '') +
            event.key.toLowerCase(),
          at: now,
        };
        const hit = choices.find(
          (c) =>
            !c.disabled && c.label.toLowerCase().startsWith(typed.current.text),
        );
        if (hit) setActive(hit.index);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [el, choices, active, choose, onClose]);

  const selected = el.value;

  return createPortal(
    <div
      ref={panel}
      style={style}
      className={clsx(
        'z-[1000] flex max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-sm shadow-xl ring-1 ring-black/5',
        above ? 'animate-pop-up' : 'animate-pop-down',
      )}
    >
      <ul ref={list} role="listbox" className="overflow-y-auto p-1">
        {choices.map((choice) => {
          const header = choice.header;
          const isSelected = choice.value === selected;
          const isPlaceholder = choice.value === '';
          return (
            <li key={choice.index} role="presentation">
              {header && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {header}
                </p>
              )}
              <div
                role="option"
                aria-selected={isSelected}
                aria-disabled={choice.disabled || undefined}
                data-index={choice.index}
                onMouseEnter={() => !choice.disabled && setActive(choice.index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(choice)}
                className={clsx(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 leading-snug transition-colors',
                  choice.disabled && 'cursor-not-allowed opacity-40',
                  active === choice.index && !choice.disabled
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-gray-800',
                  isSelected && 'font-medium text-brand-700',
                  isPlaceholder && !isSelected && 'text-gray-500',
                )}
              >
                <span className="min-w-0 flex-1 whitespace-normal break-words">
                  {choice.label}
                </span>
                <CheckIcon
                  aria-hidden="true"
                  className={clsx(
                    'h-4 w-4 shrink-0 text-accent-600',
                    isSelected ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** `YYYY-MM-DD`, the only form a date input's value takes. Built by hand: no time zone in it. */
const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** A date's `YYYY-MM-DD` or a month field's `YYYY-MM`; the day is 1 for a month. */
const parseIso = (value: string) => {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  return match
    ? {
        y: Number(match[1]),
        m: Number(match[2]) - 1,
        d: Number(match[3] ?? 1),
      }
    : null;
};
const isoMonth = (y: number, m: number) => iso(y, m, 1).slice(0, 7);
const todayIso = () => {
  const now = new Date();
  return iso(now.getFullYear(), now.getMonth(), now.getDate());
};

function Calendar({
  el,
  onClose,
}: {
  el: HTMLInputElement;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { style, above } = usePlacement(el, panel, onClose);
  // A layer (036 A8): Escape closes this calendar, never the modal the field sits in.
  useLayer(onClose);
  // A month field (`type="month"`, 2026-10-15) gets the same panel opened on its month grid, and
  // a month chosen there is the answer rather than a step towards a day.
  const monthOnly = el.type === 'month';
  const [value, setValue] = useState(el.value);
  const start = parseIso(value) ?? parseIso(todayIso())!;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [mode, setMode] = useState<'days' | 'months' | 'years'>(
    monthOnly ? 'months' : 'days',
  );
  const min = el.min || '';
  const max = el.max || '';
  const outOfRange = (day: string) =>
    Boolean((min && day < min) || (max && day > max));

  // A date typed into the field moves the calendar with it.
  useEffect(() => {
    const onInput = () => {
      setValue(el.value);
      const typed = parseIso(el.value);
      if (typed) setView({ y: typed.y, m: typed.m });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === 'Tab') onClose();
    };
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey, true);
    return () => {
      el.removeEventListener('input', onInput);
      el.removeEventListener('keydown', onKey, true);
    };
  }, [el, onClose]);

  const pick = (day: string) => {
    if (outOfRange(day)) return;
    commit(el, day);
    onClose();
    el.focus();
  };

  const shift = (months: number) =>
    setView(({ y, m }) => {
      const total = y * 12 + m + months;
      return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
    });

  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const today = monthOnly ? todayIso().slice(0, 7) : todayIso();
  const decade = Math.floor(view.y / 12) * 12;
  // The arrows stop where `min` / `max` do (2026-10-18): the months past `max` were greyed out,
  // but Next still paged on to 2031, so a picker capped at this month looked broken rather than
  // capped. A page is out of reach only when every month on it is.
  const monthAt = (offset: number) => {
    const total = view.y * 12 + view.m + offset;
    return isoMonth(Math.floor(total / 12), ((total % 12) + 12) % 12);
  };
  const maxMonth = max.slice(0, 7);
  const minMonth = min.slice(0, 7);
  const prevBlocked = Boolean(
    min &&
      (mode === 'days'
        ? monthAt(-1) < minMonth
        : mode === 'months'
          ? String(view.y - 1) < min.slice(0, 4)
          : String(decade - 1) < min.slice(0, 4)),
  );
  const nextBlocked = Boolean(
    max &&
      (mode === 'days'
        ? monthAt(1) > maxMonth
        : mode === 'months'
          ? String(view.y + 1) > max.slice(0, 4)
          : String(decade + 12) > max.slice(0, 4)),
  );

  const nav =
    'flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

  return createPortal(
    <div
      ref={panel}
      style={style}
      onMouseDown={(event) => event.preventDefault()}
      className={clsx(
        'z-[1000] w-72 select-none overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-xl ring-1 ring-black/5',
        above ? 'animate-pop-up' : 'animate-pop-down',
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous"
          className={nav}
          disabled={prevBlocked}
          onClick={() =>
            mode === 'days'
              ? shift(-1)
              : setView((v) => ({ ...v, y: v.y - (mode === 'years' ? 12 : 1) }))
          }
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() =>
            setMode(
              mode === 'days' ? 'months' : mode === 'months' ? 'years' : mode,
            )
          }
          className="rounded-lg px-2 py-1 font-semibold text-gray-900 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
        >
          {mode === 'days'
            ? `${MONTHS[view.m]} ${view.y}`
            : mode === 'months'
              ? view.y
              : `${decade} – ${decade + 11}`}
        </button>
        <button
          type="button"
          aria-label="Next"
          className={nav}
          disabled={nextBlocked}
          onClick={() =>
            mode === 'days'
              ? shift(1)
              : setView((v) => ({ ...v, y: v.y + (mode === 'years' ? 12 : 1) }))
          }
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {mode === 'days' && (
        <div key={`${view.y}-${view.m}`} className="animate-fade-in">
          <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase text-gray-500">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (d === null) return <span key={`blank-${i}`} />;
              const day = iso(view.y, view.m, d);
              const off = outOfRange(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={off}
                  onClick={() => pick(day)}
                  className={clsx(
                    'flex h-9 items-center justify-center rounded-lg tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500',
                    day === value
                      ? 'bg-brand-600 font-semibold text-white shadow-sm hover:bg-brand-500'
                      : day === today
                        ? 'font-semibold text-accent-700 ring-1 ring-inset ring-accent-300 hover:bg-accent-50'
                        : 'text-gray-800 hover:bg-brand-50 hover:text-brand-700',
                    off && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'months' && (
        <div className="grid animate-fade-in grid-cols-3 gap-1">
          {MONTHS.map((name, m) => (
            <button
              key={name}
              type="button"
              disabled={monthOnly && outOfRange(isoMonth(view.y, m))}
              onClick={() => {
                if (monthOnly) {
                  pick(isoMonth(view.y, m));
                  return;
                }
                setView({ y: view.y, m });
                setMode('days');
              }}
              className={clsx(
                'rounded-lg py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500',
                (monthOnly ? value === isoMonth(view.y, m) : m === view.m)
                  ? 'bg-brand-600 font-semibold text-white'
                  : monthOnly && today === isoMonth(view.y, m)
                    ? 'font-semibold text-accent-700 ring-1 ring-inset ring-accent-300 hover:bg-accent-50'
                    : 'text-gray-800 hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              {name.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {mode === 'years' && (
        <div className="grid animate-fade-in grid-cols-3 gap-1">
          {Array.from({ length: 12 }, (_, i) => decade + i).map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => {
                setView({ y, m: view.m });
                setMode('months');
              }}
              className={clsx(
                'rounded-lg py-2.5 tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500',
                y === view.y
                  ? 'bg-brand-600 font-semibold text-white'
                  : 'text-gray-800 hover:bg-brand-50 hover:text-brand-700',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
        <button
          type="button"
          disabled={!el.required && !value}
          onClick={() => {
            if (el.required) return;
            commit(el, '');
            onClose();
            el.focus();
          }}
          className={clsx(
            'rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500',
            (el.required || !value) && 'invisible',
          )}
        >
          Clear
        </button>
        <button
          type="button"
          disabled={outOfRange(today)}
          onClick={() => pick(today)}
          className="rounded-md px-2 py-1 text-xs font-semibold text-accent-700 transition-colors hover:bg-accent-50 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
        >
          {monthOnly ? 'This month' : 'Today'}
        </button>
      </div>
    </div>,
    document.body,
  );
}
