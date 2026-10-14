import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  EyeIcon,
  KeyIcon,
  LinkIcon,
  NoSymbolIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  PlusIcon,
  PrinterIcon,
  ShoppingCartIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid';
import { createElement } from 'react';

export type Icon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

/**
 * The icon a row action carries, from the verb it starts with (2026-10-15).
 *
 * The client: "add the icons as well on the buttons like open, edit and delete (icon + text)".
 * There are some hundred and fifty row actions, most labelled from message constants, so the icon
 * is chosen here from the label rather than passed at each one: every "Delete" in the app gets
 * the same bin, and a new action gets its icon by being worded like the others. An action whose
 * verb is not listed keeps its text alone.
 */
const BY_VERB: [RegExp, Icon][] = [
  [/^(open|go to)\b/, ArrowTopRightOnSquareIcon],
  [/^(view|preview|show|see)\b/, EyeIcon],
  [/^(edit|change|update|rename|amend|correct)\b/, PencilSquareIcon],
  [/^(delete|remove|discard)\b/, TrashIcon],
  [/^(download|export)\b/, ArrowDownTrayIcon],
  [/^(upload|replace|attach|import)\b/, ArrowUpTrayIcon],
  [/^(approve|accept)\b/, CheckCircleIcon],
  [/^(verify|confirm|mark|certify|complete|resolve|set to)\b/, CheckIcon],
  [/^(reject|decline|cancel|withdraw|close|dismiss)\b/, XMarkIcon],
  [/^(block|deactivate|disable|suspend|revoke|void)\b/, NoSymbolIcon],
  [/^(reverse|return|undo|revert|recall)\b/, ArrowUturnLeftIcon],
  [
    /^(activate|enable|restore|reopen|retry|resend|regenerate|refresh)\b/,
    ArrowPathIcon,
  ],
  [/^(pay|disburse|settle|record (a )?payment|release)\b/, BanknotesIcon],
  [/^(send|submit|share|email|notify)\b/, PaperAirplaneIcon],
  [/^(add|new|create)\b/, PlusIcon],
  [/^(duplicate|copy|clone)\b/, DocumentDuplicateIcon],
  [/^(archive)\b/, ArchiveBoxIcon],
  [/^(print)\b/, PrinterIcon],
  [/^(schedule|plan)\b/, CalendarDaysIcon],
  [/^(history|log)\b/, ClockIcon],
  [/^(issue|transfer|assign|allocate|move)\b/, ArrowRightCircleIcon],
  [/^(needs buying|buy|order|purchase)\b/, ShoppingCartIcon],
  [/^(reset)\b/, KeyIcon],
  [/^(link)\b/, LinkIcon],
  [/^(letter|generate|compose|draft)\b/, DocumentTextIcon],
  [/^(previous|prev|back)\b/, ChevronLeftIcon],
  [/^(next|more)\b/, ChevronRightIcon],
];

/** The text a label renders, when it is plain text or a run of it. */
export function labelText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(labelText).join('');
  return '';
}

export function actionIcon(label: string): Icon | null {
  const verb = label.trim().toLowerCase();
  if (!verb) return null;
  return BY_VERB.find(([pattern]) => pattern.test(verb))?.[1] ?? null;
}

/**
 * The icon for a row action: the one given, or the one its label's verb picks; nothing when
 * `icon` is `null` or no verb matches.
 */
export function ActionGlyph({
  label,
  icon,
}: {
  label: React.ReactNode;
  icon?: Icon | null;
}) {
  const chosen = icon === undefined ? actionIcon(labelText(label)) : icon;
  if (!chosen) return null;
  return createElement(chosen, {
    'aria-hidden': true,
    className: 'h-3.5 w-3.5 shrink-0',
  });
}
