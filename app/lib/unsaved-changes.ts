'use client';

import { useEffect } from 'react';

/**
 * Which screens currently hold edits nobody has saved (019 FR-006).
 *
 * **A module-level set rather than a context**, which is unusual enough here to justify. The reader
 * is the company switcher in the shell header; the writers are forms several levels deep in the page
 * tree. A context spanning both would have to wrap the entire application so that a header could
 * observe a form — and nothing needs to *re-render* when this changes. The switcher reads it once,
 * at the moment somebody clicks it.
 *
 * Keyed by a label rather than counted, so a form that re-registers on every render cannot inflate
 * the count and leave the app permanently convinced there is unsaved work.
 */
const dirtyScreens = new Set<string>();

/** True while any registered screen holds unsaved edits. */
export function hasUnsavedChanges(): boolean {
  return dirtyScreens.size > 0;
}

/** The screens holding them, for a message that can name what is at risk. */
export function unsavedScreens(): string[] {
  return [...dirtyScreens];
}

/**
 * Registers a form's dirty state for the lifetime of the component.
 *
 * Deregisters on unmount, which is the case that matters: a user who navigates away from a dirty
 * form has already been asked about it by that screen's own guard, and leaving the entry behind
 * would make every later company switch warn about a form that no longer exists.
 *
 * **This is opt-in, and only the forms that call it are covered.** A company switch cannot know
 * about unsaved work nobody told it about, and a hook that silently covered nothing would be worse
 * than one whose coverage is countable.
 */
export function useUnsavedChanges(label: string, isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      dirtyScreens.delete(label);
      return;
    }
    dirtyScreens.add(label);
    // Braces, not a concise arrow: `Set.delete` returns a boolean and React reads a truthy return
    // from an effect as a misplaced async function.
    return () => {
      dirtyScreens.delete(label);
    };
  }, [label, isDirty]);
}
