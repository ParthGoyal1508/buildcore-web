import Image from 'next/image';
import Link from 'next/link';

import { COMPANY, NAV } from '@/app/lib/site-content';

export default function SiteFooter() {
  return (
    <footer className="bg-brand-900 text-gray-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1.4fr]">
        <div>
          <Image
            src="/site/tirupati-logo-white.png"
            alt="Tirupati Enterprises"
            width={892}
            height={180}
            className="h-10 w-auto"
          />
          <p className="mt-4 max-w-xs text-sm leading-6 text-brand-200">
            {COMPANY.tagline}.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Explore
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="hover:text-white">
                Employee Login
              </Link>
            </li>
          </ul>
        </nav>

        <div className="text-sm leading-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
            Contact
          </h2>
          <p className="mt-4">
            <span className="font-medium text-white">Corporate Office: </span>
            {COMPANY.corporateOffice}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4">
            {COMPANY.phones.map((phone) => (
              <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="hover:text-white">
                {phone}
              </a>
            ))}
          </p>
          <p>
            <a href={`mailto:${COMPANY.email}`} className="hover:text-white">
              {COMPANY.email}
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-brand-300 sm:px-6">
          © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
