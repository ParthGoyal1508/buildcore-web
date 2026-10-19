'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * The stack of things drawn over the page — modals, confirm dialogs, pickers, calendars — so that
 * Escape closes only the one on top (036 A8).
 *
 * Every modal used to listen for Escape on the document, in the capture phase, ahead of anything
 * inside it. Escape pressed to dismiss a confirmation, a calendar or a dropdown *inside* a modal
 * closed the whole modal instead, taking the form's input with it — while the confirmation it was
 * aimed at stayed on screen. (Item masters → Delete a category → Esc reproduced it.)
 *
 * Now each layer registers here when it opens and leaves when it closes, and one listener on
 * `window` — in the bubble phase, so after every element's own handler — gives Escape to the top
 * layer only. A control that handles Escape itself (a combobox closing its list) calls
 * `preventDefault()`, and the listener then leaves it alone.
 *
 * Registration order is opening order. A layer opened *inside* another at the same instant would
 * register first (children's effects run before their parent's), which nothing does today: a
 * confirmation or a picker always opens on a later interaction than the modal it sits in.
 */

interface Layer {
  id: number;
  onEscape: () => void;
}

let nextId = 1;
const stack: Layer[] = [];
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = stack[stack.length - 1];
  if (!top) return;
  event.preventDefault();
  top.onEscape();
}

function push(layer: Layer) {
  stack.push(layer);
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    listening = true;
  }
}

function pop(id: number) {
  const index = stack.findIndex((layer) => layer.id === id);
  if (index >= 0) stack.splice(index, 1);
  if (stack.length === 0 && listening) {
    window.removeEventListener('keydown', onKeyDown);
    listening = false;
  }
}

/**
 * Registers the calling component as a layer while `active`. Escape calls `onEscape` only when this
 * is the top layer and nothing beneath the focus already handled the key.
 *
 * Returns `isTop()`, for a layer's own key handling (a focus trap) that must stand aside while
 * something is open above it.
 */
export function useLayer(onEscape: () => void, active = true) {
  const handler = useRef(onEscape);
  const id = useRef(0);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const layer: Layer = { id: nextId++, onEscape: () => handler.current() };
    id.current = layer.id;
    push(layer);
    return () => pop(layer.id);
  }, [active]);

  return useCallback(() => stack[stack.length - 1]?.id === id.current, []);
}

let scrollLocks = 0;
let savedOverflow = '';

/**
 * Stops the page behind a modal scrolling while it is open (036 A10). Counted, so two stacked
 * modals unlock only when the last one closes.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    if (scrollLocks === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) document.body.style.overflow = savedOverflow;
    };
  }, [active]);
}
