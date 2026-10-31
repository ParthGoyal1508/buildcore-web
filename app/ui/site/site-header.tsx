'use client';

import { Bars3Icon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { NAV } from '@/app/lib/site-content';

const HEADER_NAV = NAV.filter((item) => !item.footerOnly);

/**
 * The website's header: logo, the section menu and the way into the ERP (053).
 *
 * The desktop dropdowns open on hover and on keyboard focus (`focus-within`), so they need no
 * state. "Employee Login" goes to `/login`, which sends anyone already signed in straight on to
 * their own home.
 */
export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-20">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Image
            src="/site/tirupati-logo.png"
            alt="Tirupati Enterprises"
            width={892}
            height={180}
            priority
            className="h-7 w-auto sm:h-9 lg:h-11"
          />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {HEADER_NAV.map((item) => (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-brand-600'
                      : 'text-gray-700 hover:text-brand-600',
                  )}
                >
                  {item.label}
                  {item.children && (
                    <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                </Link>
                {item.children && (
                  <ul className="invisible absolute left-0 top-full min-w-56 rounded-lg border border-gray-200 bg-white p-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-600"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 sm:px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
          >
            Employee Login
          </Link>
          <button
            type="button"
            className="rounded-md p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-expanded={open}
            aria-controls="site-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <XMarkIcon aria-hidden="true" className="h-6 w-6" />
            ) : (
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-mobile-menu"
          aria-label="Main"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-gray-200 bg-white px-4 pb-6 lg:hidden"
        >
          <ul className="divide-y divide-gray-100">
            {HEADER_NAV.map((item) => (
              <li key={item.href} className="py-2">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'block py-2 text-base font-semibold',
                    isActive(item.href) ? 'text-brand-600' : 'text-gray-900',
                  )}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="mb-1 grid grid-cols-2 gap-x-4">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="block py-1.5 text-sm text-gray-600"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
