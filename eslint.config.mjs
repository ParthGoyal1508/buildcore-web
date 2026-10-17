import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

// One date format (036 A18, decision 7: DD-MM-YYYY everywhere). Inline `toLocaleDateString` was in
// 18 places with five locales between them, and each followed the browser, so one date read
// differently on two laptops. Use `dateLabel`, `dateTimeLabel`, `clockTime`, `periodLabel` or
// `longDateLabel` from `app/lib/format.ts`. A warning for now; an error once Wave 3 lands.
const DATE_RULES = [
  {
    selector: "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]",
    message:
      'Format dates with the helpers in @/app/lib/format (dateLabel, dateTimeLabel, clockTime, periodLabel, longDateLabel).',
  },
  {
    selector:
      "CallExpression[callee.property.name='toLocaleString'][callee.object.type='NewExpression'][callee.object.callee.name='Date']",
    message:
      'Format dates with the helpers in @/app/lib/format (dateLabel, dateTimeLabel, clockTime).',
  },
];

// The design system's guard rails (036 A21, A22). Each one is a class of regression the audit
// counted by the dozen; warnings, so the build is never blocked by one, but `npm run lint` shows
// where a new one crept in. Strings are checked wherever they are — a `className`, a `clsx` call,
// a constant of classes — because that is where the classes live.
const CLASS_IN = (pattern) => [
  `Literal[value=${pattern}]`,
  `TemplateElement[value.raw=${pattern}]`,
];
const CLASS_RULES = [
  // Real text at ≥4.5:1 (A22): gray-400 on white is about 2.6:1. An icon may stay at gray-400 —
  // it is decorative and `aria-hidden` — so a class on a `…Icon` or `Spinner` element is exempt.
  ...CLASS_IN(String.raw`/(^|\s)text-gray-400(\s|$)/`).map((selector) => ({
    selector: `${selector}:not(JSXOpeningElement[name.name=/(Icon|Spinner)$/] *)`,
    message:
      'text-gray-400 is too faint for text (≈2.6:1). Use text-gray-500, or text-gray-600 on a gray-50 ground. Icons may keep it.',
  })),
  // No text below 12px (A22).
  ...CLASS_IN(String.raw`/text-\[(\d|10|11)(\.\d+)?px\]/`).map((selector) => ({
    selector,
    message: 'Text below 12px is not allowed; use text-xs.',
  })),
  // Colours come from the theme (A21): a one-off hex is a colour nobody can find again.
  ...CLASS_IN(String.raw`/(^|[\s:])[a-z-]+-\[#[0-9a-fA-F]{3,8}\]/`).map((selector) => ({
    selector,
    message:
      'Arbitrary hex colours bypass the theme. Add a token in tailwind.config.ts (brand, accent, success, warning, danger, info, neutral).',
  })),
  // `blue-*` was remapped to the brand navy and is on its way back to being Tailwind's blue (A21).
  ...CLASS_IN(String.raw`/(^|[\s:])(bg|text|border|ring|outline|from|via|to|divide|fill|stroke|decoration)-blue-\d/`).map(
    (selector) => ({
      selector,
      message: 'Use brand-* for the brand colour; blue-* is being returned to Tailwind’s own blue.',
    }),
  ),
];

// Raw `<button>`s (A21): use a variant from `app/ui/button.tsx`. A control that announces itself
// as something other than a plain button — `role="tab"`, `aria-pressed`, `aria-expanded`… — is a
// custom control and exempt; so are the files below, whose buttons are calendar cells, sortable
// headers, photo thumbnails and the like.
const BUTTON_RULE = {
  selector:
    "JSXOpeningElement[name.name='button']:not(:has(JSXAttribute[name.name=/^(role|aria-pressed|aria-selected|aria-current|aria-expanded|aria-haspopup|aria-checked)$/]))",
  message:
    'Use Button, SecondaryButton, DangerButton, TextButton, IconButton or RowAction from @/app/ui/button. A custom control (tab, menu item, option) should carry its role.',
};
const CUSTOM_BUTTON_FILES = [
  'app/ui/button.tsx',
  'app/ui/native-pickers.tsx',
  'app/ui/table.tsx',
  'app/ui/async-select.tsx',
  'app/ui/company-switcher.tsx',
  'app/ui/plant/equipment-photos.tsx',
  'app/ui/projects/dwr-attachments.tsx',
  'app/ui/projects/bill-sheet.tsx',
  'app/ui/projects/boq-tree.tsx',
  'app/ui/letters/letter-templates-manager.tsx',
  'app/dashboard/labour/muster-attendance/page.tsx',
  'app/dashboard/partners/contractors/rag/page.tsx',
  'app/labour/attendance/page.tsx',
];

// `next lint` was removed in Next 16, which left this project's `npm run lint`
// pointing at a command that no longer exists. This restores linting by applying
// the same rule sets that command used to, driven by the ESLint CLI directly.
// `eslint-config-next` v16 ships native flat configs, so they are spread in
// as-is rather than wrapped in FlatCompat.
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'tsconfig.tsbuildinfo',
      'public/**',
      // Agent worktrees each hold a full checkout and its build output; linting them buried
      // this repo's own 11 warnings under 57,000 problems from other branches (036 A31).
      '.claude/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // The three fetch primitives in `app/lib/api/client.ts` send no access token. Only
    // `app/lib/session.ts` may call them, because that is where the token is attached and where a
    // 401 is turned into one refresh-and-retry rather than a failed screen. An api module that
    // imports them directly compiles, type-checks, and answers 401 for every signed-in user — which
    // is how `downloadDwrAttachment` shipped reporting that an attachment could not be opened.
    files: ['app/lib/api/**', 'app/ui/**', 'app/dashboard/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/app/lib/api/client',
              importNames: ['apiFetch', 'apiFetchBlob', 'apiFetchFile'],
              message:
                'Use authFetch / authFetchBlob / authFetchFile from @/app/lib/session — the client primitives attach no access token.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['app/**/*.{ts,tsx}'],
    ignores: ['app/lib/format.ts', ...CUSTOM_BUTTON_FILES],
    rules: {
      'no-restricted-syntax': ['warn', ...DATE_RULES, ...CLASS_RULES, BUTTON_RULE],
    },
  },
  {
    // The same minus the button rule — flat config replaces a rule's options rather than merging
    // them, so the exempt files need the rest restated.
    files: CUSTOM_BUTTON_FILES,
    rules: {
      'no-restricted-syntax': ['warn', ...DATE_RULES, ...CLASS_RULES],
    },
  },
  {
    files: ['app/lib/format.ts'],
    rules: {
      'no-restricted-syntax': ['warn', ...CLASS_RULES],
    },
  },
];

export default config;
