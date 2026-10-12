'use client';

import { useQuery } from '@tanstack/react-query';

import { useSelectedCompany } from '@/app/lib/api/company-selection';
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
 */
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
  const companyId = company?.hasLogo ? company.id : null;

  const logo = useQuery({
    queryKey: ['companies', companyId, 'logo'],
    queryFn: () => companyLogoDataUrl(companyId as string),
    enabled: companyId !== null,
    // The mark does not change while somebody is working, so this is fetched once and
    // read from cache by every later navigation. A company switch clears the whole
    // cache, which is exactly what makes the new company's mark appear.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

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
    if (companyId !== null && !logo.isError) {
      return <span aria-hidden className={`block ${className ?? ''}`} />;
    }
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
      alt={company?.name ?? ''}
      className={`w-auto object-contain ${knockout ? 'brightness-0 invert' : ''} ${
        className ?? ''
      }`}
    />
  );
}

/** The company's logo as a `data:` URL, fetched with the session's token. */
async function companyLogoDataUrl(companyId: string): Promise<string> {
  const blob = await authFetchBlob(`/settings/companies/${companyId}/logo`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunked: `String.fromCharCode(...bytes)` on a 42KB logo spreads 42,000 arguments
  // onto the call stack, which throws on some engines and is a cliff nobody hits until
  // somebody uploads a bigger picture.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(binary)}`;
}
