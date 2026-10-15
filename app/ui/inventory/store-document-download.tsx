'use client';

import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useRef, useState } from 'react';

import type { StoredFile } from '@/app/lib/api/client';
import type { StoreDocumentFormat } from '@/app/lib/api/inventory';
import { ApiError } from '@/app/lib/api/client';
import { saveBlob } from '@/app/lib/download-file';
import { FileGlyph } from '@/app/ui/file-icons';
import { RowAction } from '@/app/ui/settings/form-fields';

const FORMATS: { format: StoreDocumentFormat; label: string }[] = [
  { format: 'pdf', label: 'PDF' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'docx', label: 'Word' },
];

// The panel's size, for placing it before it has rendered: three 36px items and its padding.
const PANEL_WIDTH = 144;
const PANEL_HEIGHT = 118;

/** Right-aligned under the button, kept on screen, and above it near the bottom edge. */
function placementFor(button: HTMLElement | null) {
  const rect = button?.getBoundingClientRect();
  if (!rect) return { top: 0, left: 0 };
  return {
    top:
      rect.bottom + PANEL_HEIGHT + 8 > window.innerHeight
        ? rect.top - PANEL_HEIGHT - 4
        : rect.bottom + 4,
    left: Math.max(
      8,
      Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8),
    ),
  };
}

/**
 * One store document — an issue slip, a challan, a GRN — offered as PDF, Excel or Word
 * (2026-10-15).
 *
 * A menu rather than three buttons: a transfer row carries two documents, and six format
 * buttons beside "Mark received" and "Delete" turned the row's actions into a paragraph. The
 * panel is positioned against the viewport rather than inside the row, because the table
 * scrolls sideways and anything absolutely placed inside it is clipped by that scroll box.
 *
 * Always a read: downloading changes nothing, so a reader gets it too.
 */
export default function StoreDocumentDownload({
  label,
  fallbackName,
  load,
  onError,
}: {
  /** What the button says — "Slip", "Challan", "GRN". */
  label: string;
  /** The name to save under when the server's response carried none, without extension. */
  fallbackName: string;
  load: (format: StoreDocumentFormat) => Promise<StoredFile>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<StoreDocumentFormat | null>(null);
  const [placement, setPlacement] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  // On a wrapper, because `RowAction` takes no ref; the wrapper is exactly the button's box.
  const buttonRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.querySelector('button')?.focus();
      }
    };
    // A fixed panel follows its button as the page or the table scrolls. It used to close
    // instead, but focusing the button scrolls a sideways-scrolling table to show it, and that
    // scroll arrived just after the click had opened the menu — so it never stayed open.
    const follow = () => setPlacement(placementFor(buttonRef.current));
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open]);

  function toggle() {
    setPlacement(placementFor(buttonRef.current));
    setOpen((value) => !value);
  }

  async function get(format: StoreDocumentFormat) {
    setBusy(format);
    try {
      const { blob, filename } = await load(format);
      saveBlob(blob, filename ?? `${fallbackName}.${format}`);
      setOpen(false);
    } catch (err) {
      onError(
        err instanceof ApiError
          ? err.message
          : `Could not produce the ${label.toLowerCase()}.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <span ref={buttonRef} className="inline-flex">
        <RowAction
          intent="read"
          icon={ArrowDownTrayIcon}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        >
          {label}
          <ChevronDownIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
        </RowAction>
      </span>
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={`Download ${label}`}
          style={{ top: placement.top, left: placement.left }}
          className="fixed z-50 flex w-36 flex-col rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {FORMATS.map(({ format, label: formatLabel }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              disabled={busy !== null}
              onClick={() => void get(format)}
              className="flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none disabled:opacity-50"
            >
              <FileGlyph label={formatLabel} />
              {busy === format ? 'Producing…' : formatLabel}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
