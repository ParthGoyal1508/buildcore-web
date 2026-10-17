import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

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
    // One date format (036 A18, decision 7: DD-MM-YYYY everywhere). Inline `toLocaleDateString` was
    // in 18 places with five locales between them, and each followed the browser, so one date read
    // differently on two laptops. Use `dateLabel`, `dateTimeLabel`, `clockTime`, `periodLabel` or
    // `longDateLabel` from `app/lib/format.ts`. A warning for now; an error once Wave 3 lands.
    files: ['app/**/*.{ts,tsx}'],
    ignores: ['app/lib/format.ts'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(Date|Time)String$/]",
          message:
            'Format dates with the helpers in @/app/lib/format (dateLabel, dateTimeLabel, clockTime, periodLabel, longDateLabel).',
        },
        {
          selector:
            "CallExpression[callee.property.name='toLocaleString'][callee.object.type='NewExpression'][callee.object.callee.name='Date']",
          message:
            'Format dates with the helpers in @/app/lib/format (dateLabel, dateTimeLabel, clockTime).',
        },
      ],
    },
  },
];

export default config;
