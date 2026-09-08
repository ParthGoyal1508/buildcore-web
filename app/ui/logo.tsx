import clsx from 'clsx';
import Image from 'next/image';

/** The intrinsic pixels of `public/logo.png`. `next/image` needs the real ratio to
 *  reserve the right box before the file loads; the rendered size comes from the
 *  `h-*` in `className`, with `w-auto` keeping this 3.87:1 mark undistorted. */
const INTRINSIC = { width: 530, height: 137 };

/**
 * The company mark, in the four places the "BuildCore" wordmark used to be: the
 * sidebar panel, the mobile shell header, the login screen and the auth notices.
 *
 * Served from `public/` rather than hotlinked from parthrealcon.com. An external host
 * in the markup is a request the app cannot control the latency or availability of,
 * it leaks a referrer on every page load, and this app is a PWA whose service worker
 * precaches its own shell — a remote logo is the one part of that shell that would
 * still fail offline.
 *
 * `knockout` renders it white for the blue brand panels. The mark is navy on
 * transparent, which does not read on `bg-blue-600`, and a white knockout is the
 * standard treatment for that rather than a second file to keep in sync. It works
 * because the mark is effectively two-tone; a future multi-colour logo would need a
 * real white variant instead, which is why this is a named prop and not a bare filter
 * at each call site.
 */
export default function Logo({
  className,
  knockout = false,
  priority = false,
}: {
  /** Set the height here — e.g. `h-8 w-auto`. */
  className?: string;
  knockout?: boolean;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Parth Realcon Private Limited"
      width={INTRINSIC.width}
      height={INTRINSIC.height}
      priority={priority}
      // Served straight from `/logo.png` rather than through `/_next/image`. The
      // service worker precaches `/logo.png` (it is in `public/`) but not the
      // optimiser's query URLs, so an optimised src is the one part of the `/my`
      // shell that would come back broken offline — on the screen a site worker with
      // no signal is most likely to be looking at. A 16KB mark rendered at 28-40px
      // has nothing to gain from the optimiser anyway.
      unoptimized
      className={clsx('w-auto', knockout && 'brightness-0 invert', className)}
    />
  );
}
