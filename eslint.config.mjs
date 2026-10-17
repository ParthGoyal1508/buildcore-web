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
];

export default config;
