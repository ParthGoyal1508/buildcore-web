'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import {
  listSelectableCompanies,
  useSelectedCompany,
  type SelectableCompany,
} from '@/app/lib/api/company-selection';
import { authFetchBlob } from '@/app/lib/session';
import Logo from '@/app/ui/logo';

/**
 * The selected company's own logo, falling back to the product mark (2026-10-12).
 *
 * Switching company switches the mark, which is what makes a two-company group legible:
 * the sidebar is the one thing on screen at all times, and until now it said the same
 * thing whichever company's data was below it.
 *
 * ## Why a fetch rather than an `<img src>`
 *
 * The access token lives in memory and never appears in a URL, so a protected image
 * cannot be reached by putting its address in the markup — the same constraint
 * `session.ts` records for stored documents, and the reason `authFetchBlob` exists.
 *
 * ## Why a data URL rather than an object URL
 *
 * An object URL pins its blob until it is revoked, so it needs an effect to release it
 * on unmount — and this component sits in a shell that remounts on every navigation. The
 * obvious version of that (`createObjectURL` into state inside an effect) is both a
 * cascading render the linter rejects and the classic React-strict-mode trap, where the
 * first pass's cleanup revokes the URL the second pass is still holding and the image
 * breaks in development only.
 *
 * A data URL has no lifecycle to get wrong. It costs about a third more bytes in memory
 * for a file that is tens of kilobytes, converted once and then held in the query cache
 * for the session.
 *
 * ## Why it falls back rather than failing
 *
 * `<Logo/>` is served from `public/` and precached by the service worker, so it is the
 * one mark always available — on the sign-in page where there is no company, in the auth
 * notices, and in a PWA shell with no signal.
 *
 * `hasLogo` comes from the selectable-companies call the switcher already makes, so a
 * company without a logo costs no request at all rather than a 404 per navigation.
 *
 * ## Why switching company is instant now (2026-10-14)
 *
 * "The company logo takes too long to load when switching companies." It waited on four things
 * in a row: the switch itself, a refetch of the company list to learn which company was now
 * selected, a fresh download of a logo the browser had very likely already shown — the switch's
 * cache sweep threw it away — and the image decode. Each is gone or overlapped:
 *
 * - **Keyed by version, kept across switches.** The cache key is the company *and* the logo's
 *   fingerprint (`logoVersion`), so an entry can never be the wrong company's mark or a
 *   superseded one, and `company-switcher.tsx` leaves these entries alone when it resets
 *   everything else.
 * - **Prefetched.** Every selectable company's logo is fetched, once, as soon as the company list
 *   is known — so the one you switch to is already in memory.
 * - **No refetch to learn the selection.** The switcher takes the new list from the switch's own
 *   response.
 * - **Decoded before it is shown.** The query resolves only once the image is decoded, and the
 *   previous mark stays on screen until then, so there is never a blank frame between two logos.
 * - **HTTP-cacheable.** The URL carries `?v=<fingerprint>`, which the API answers with a one-year
 *   `immutable` cache header, so a reload fetches nothing either.
 */

/** The query-key prefix for logos. Exported for the switcher's sweep, which must skip them. */
export const COMPANY_LOGO_KEY = 'company-logo';

const logoQuery = (company: Pick<SelectableCompany, 'id' | 'logoVersion'>) => ({
  queryKey: [
    COMPANY_LOGO_KEY,
    company.id,
    company.logoVersion,
    'clean',
  ] as const,
  queryFn: () => companyLogoDataUrl(company.id, company.logoVersion),
  // A versioned image never changes, so it is fetched once per version and kept for the
  // session. A new upload is a new version and therefore a new key.
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
});

export default function CompanyLogo({
  className,
  knockout = false,
  priority = false,
}: {
  className?: string;
  knockout?: boolean;
  priority?: boolean;
}) {
  const company = useSelectedCompany();
  const withLogo = company?.hasLogo ? company : null;

  const logo = useQuery({
    ...logoQuery(withLogo ?? { id: '', logoVersion: null }),
    enabled: withLogo !== null,
    // Between a switch and the new mark being ready, keep showing the one already on screen
    // rather than a blank — the decode-before-resolve below makes that window a frame or two
    // at most, and the prefetch usually makes it nothing.
    placeholderData: (previous) => previous,
  });

  usePrefetchCompanyLogos();

  if (!logo.data) {
    /**
     * A company that *has* a logo renders a reserved blank until it arrives, not the
     * product mark.
     *
     * The fallback is Parth Realcon's mark — it is what `public/logo.png` depicts — so
     * showing it while another company's logo is in flight flashes the wrong company's
     * branding at somebody working in theirs. A blank of the same size says nothing
     * rather than something false, and holds the layout so the sidebar does not jump
     * when the real mark lands.
     *
     * A company with no logo, or one whose logo could not be loaded, still gets the
     * product mark: nothing else is coming, and an empty panel just looks broken.
     */
    if (withLogo !== null && !logo.isError) {
      return <span aria-hidden className={`block ${className ?? ''}`} />;
    }
    return (
      <Logo className={className} knockout={knockout} priority={priority} />
    );
  }

  // A company that has no logo must not keep showing the previous company's placeholder.
  if (withLogo === null) {
    return (
      <Logo className={className} knockout={knockout} priority={priority} />
    );
  }

  return (
    // A plain `<img>`, not `next/image`: the source is a data URL built at runtime, which
    // the optimiser can neither fetch nor size, and `Logo` already documents why even the
    // static mark bypasses it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.data}
      alt={logo.isPlaceholderData ? '' : (company?.name ?? '')}
      className={`${className?.includes('w-full') ? '' : 'w-auto'} object-contain ${knockout ? 'brightness-0 invert' : ''} ${
        className ?? ''
      }`}
    />
  );
}

/**
 * Fetches every selectable company's logo in the background, once, so a switch finds the next
 * company's mark already decoded in memory.
 *
 * Cheap by construction: only companies that have a logo, one request per logo version for the
 * whole session (the queries never go stale), and the API lets the browser cache them for a year.
 * A two-company group pays for one extra small image, once.
 */
function usePrefetchCompanyLogos() {
  const { data: companies } = useQuery({
    queryKey: ['companies', 'selectable'],
    queryFn: listSelectableCompanies,
  });
  useQueries({
    queries: (companies ?? [])
      .filter((company) => company.hasLogo)
      .map((company) => logoQuery(company)),
  });
}

/**
 * The company's logo as a decoded `data:` URL, fetched with the session's token.
 *
 * Resolves only after the browser has decoded the image, so the `<img>` that receives it
 * paints on its first frame instead of flashing empty while it decodes.
 */
async function companyLogoDataUrl(
  companyId: string,
  version: string | null,
): Promise<string> {
  const query = version ? `?v=${encodeURIComponent(version)}` : '';
  const blob = await authFetchBlob(
    `/settings/companies/${companyId}/logo${query}`,
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunked: `String.fromCharCode(...bytes)` on a 42KB logo spreads 42,000 arguments
  // onto the call stack, which throws on some engines and is a cliff nobody hits until
  // somebody uploads a bigger picture.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const url = `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
  return typeof document === 'undefined' ? url : cleanLogo(url);
}

/**
 * The logo as the shell shows it: its backdrop made transparent and its empty margin trimmed
 * (2026-10-15).
 *
 * Companies upload whatever file they have, and the two live ones differ in exactly the ways that
 * showed: Tirupati's sits on a grey panel, Parth's on white with wide margins. Drawn as uploaded,
 * one read as a grey box on the sidebar and the two came out at visibly different sizes in the
 * same slot. So the flat colour the four corners agree on is keyed out — softly, so edges stay
 * smooth — and the picture is cropped to what remains, which lets every logo fill the slot the
 * same way. Done in the browser, once per logo version (the query caches it forever), and the
 * uploaded file is never touched.
 *
 * Left as uploaded when the corners disagree — a photograph, a gradient, a logo that already has
 * transparency — because there is then no single backdrop to remove.
 */
async function cleanLogo(url: string): Promise<string> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return url;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return url;
    context.drawImage(image, 0, 0);
    const frame = context.getImageData(0, 0, width, height);
    const px = frame.data;

    const at = (x: number, y: number) => (y * width + x) * 4;
    const corners = [
      at(0, 0),
      at(width - 1, 0),
      at(0, height - 1),
      at(width - 1, height - 1),
    ];
    const backdrop = [0, 1, 2].map(
      (c) => corners.reduce((sum, i) => sum + px[i + c], 0) / corners.length,
    );
    const distance = (i: number) =>
      Math.hypot(
        px[i] - backdrop[0],
        px[i + 1] - backdrop[1],
        px[i + 2] - backdrop[2],
      );
    const flat = corners.every((i) => px[i + 3] > 250 && distance(i) < 24);

    if (flat) {
      // Within 28 of the backdrop is backdrop; beyond 64 is the mark; between, a soft edge.
      for (let i = 0; i < px.length; i += 4) {
        const d = distance(i);
        if (d < 28) px[i + 3] = 0;
        else if (d < 64) px[i + 3] = Math.round((px[i + 3] * (d - 28)) / 36);
      }
    }

    let top = height;
    let left = width;
    let bottom = -1;
    let right = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (px[at(x, y) + 3] > 16) {
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
    }
    if (right < left || bottom < top) return url;

    context.putImageData(frame, 0, 0);
    const cropped = document.createElement('canvas');
    cropped.width = right - left + 1;
    cropped.height = bottom - top + 1;
    cropped
      .getContext('2d')
      ?.drawImage(
        canvas,
        left,
        top,
        cropped.width,
        cropped.height,
        0,
        0,
        cropped.width,
        cropped.height,
      );
    return cropped.toDataURL('image/png');
  } catch {
    return url;
  }
}

/**
 * One company's logo, small, for the company menu (2026-10-15) — or its initials where it has
 * none. Reads the same cached query the sidebar does, so opening the menu fetches nothing new.
 */
export function CompanyMark({
  company,
}: {
  company: Pick<SelectableCompany, 'id' | 'name' | 'hasLogo' | 'logoVersion'>;
}) {
  const logo = useQuery({
    ...logoQuery(company),
    enabled: company.hasLogo,
  });
  if (company.hasLogo && logo.data) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a data URL from the logo query; next/image cannot optimise it
      <img
        src={logo.data}
        alt=""
        className="max-h-full max-w-full object-contain"
      />
    );
  }
  const initials = company.name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
  return <span className="text-xs font-bold text-brand-500">{initials}</span>;
}
