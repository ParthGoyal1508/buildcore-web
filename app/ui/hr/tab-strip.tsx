'use client';

import clsx from 'clsx';
import { useRef } from 'react';

/**
 * A keyboard-operable tab strip, following the ARIA tabs pattern.
 *
 * Arrow keys move between tabs, Home/End jump to the ends, and only the active tab
 * is in the Tab order — which is the part a `<button>`-per-tab implementation
 * usually gets wrong, leaving a keyboard user to Tab through eight tabs to reach
 * the panel. Constitution VI's keyboard-operability requirement is not scoped by
 * viewport, so this applies on the desktop surfaces too.
 *
 * The strip itself scrolls horizontally rather than wrapping: eight tabs wrap into
 * a two-row block that shifts the panel down as the active tab changes.
 */
export default function TabStrip<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  idPrefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index < 0) return;

    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    const target = tabs[next];
    onChange(target.id);
    refs.current[target.id]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Sections"
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-gray-200"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
              selected
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** The panel half of the pattern — labelled by its tab, so the association is real. */
export function TabPanel({
  id,
  idPrefix,
  active,
  children,
}: {
  id: string;
  idPrefix: string;
  active: string;
  children: React.ReactNode;
}) {
  if (id !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      tabIndex={0}
      className="py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {children}
    </div>
  );
}
