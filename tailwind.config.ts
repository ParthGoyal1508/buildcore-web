import forms from '@tailwindcss/forms';
import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * The brand navy ramp — see the note on `blue` below for how it was built and measured.
 * Named once and used twice: as `blue` (what ~250 existing classes already say) and as
 * `brand` (what new shell code says, so it reads as intent rather than as a hue).
 */
const brand = {
  50: '#eff6fb',
  100: '#d7e8f4',
  200: '#b0d1e8',
  300: '#7db0d4',
  400: '#3580b6',
  500: '#0a4976',
  600: '#002d4e',
  700: '#00243d',
  800: '#001b2e',
  900: '#001524',
  950: '#000c14',
};

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
      },
      colors: {
        /**
         * The brand navy, taken from the company mark.
         *
         * `blue` is overridden rather than a `brand` colour added beside it, because
         * every one of the ~250 `blue-*` classes in the app already means "the brand
         * colour" — a parallel palette would mean touching all of them and would leave
         * two names for one idea, drifting apart the first time someone reached for the
         * familiar one.
         *
         * `600` is the anchor: #002d4e exactly, the mark's own navy, and the shade the
         * brand panels and the primary button use. The rest is a single hue (205°) ramp
         * around it, which is what the previous three-shade override lacked — it set
         * 400/500/600 to unrelated vivid blues from the Next.js dashboard template and
         * left 50/100/700/800/900 as stock Tailwind, so a badge and a button were two
         * different blues.
         *
         * Contrast was measured, not eyeballed: white on 600 is 14.1:1, the 500 focus
         * ring on white 9.4:1, 800 text on a 100 badge 14.0:1 — all well past WCAG AA,
         * which the old vivid #0070F3 focus ring (3.4:1) barely cleared.
         */
        blue: brand,
        brand,
        /**
         * The colour pass (2026-10-14 — "Use a more colourful palette; the current look feels
         * washed out").
         *
         * **`gray` is Tailwind's `slate`.** The app is mostly grey — about 2,000 `gray-*`
         * classes — and stock grey is a dead neutral that, beside a navy brand, is what read as
         * washed out. Slate is the same lightness ramp with a cool blue cast, so every border,
         * label and panel now leans toward the brand instead of away from it, without touching
         * one of those classes. Contrast is unchanged in practice: slate-500 on white is 4.8:1
         * against grey-500's 4.8:1 (measured), and slate-600 is 7.6:1.
         *
         * **`accent`** is the bright partner to the navy — the azure from the same family — for
         * the places a navy-on-white shell had nothing lively to offer: the active sidebar icon,
         * the header's brand rule, highlights. 700 on white is 5.9:1, enough for text; 600 (4.1:1)
         * is for icons and fills, never body copy.
         *
         * **`success` / `warning` / `danger`** name the three states every status already uses,
         * so new code can say what it means. They alias emerald, amber and rose — the saturated
         * versions of the green, yellow and red the badges already carry.
         */
        gray: colors.slate,
        accent: colors.sky,
        success: colors.emerald,
        warning: colors.amber,
        danger: colors.rose,
      },
    },
    keyframes: {
      shimmer: {
        '100%': {
          transform: 'translateX(100%)',
        },
      },
    },
  },
  plugins: [forms],
};
export default config;
