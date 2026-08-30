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
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default config;
