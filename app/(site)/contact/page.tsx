import { BuildingOfficeIcon, EnvelopeIcon, MapPinIcon, PhoneIcon } from '@heroicons/react/24/outline';
import type { Metadata } from 'next';

import { COMPANY } from '@/app/lib/site-content';
import { PageHero } from '@/app/ui/site/blocks';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Contact Tirupati Enterprises, Deoli (Tonk), Rajasthan.',
};

export default function ContactPage() {
  const mapQuery = encodeURIComponent(`Tirupati House, Gaurav Path Road, Deoli, Tonk, Rajasthan 304804`);
  return (
    <>
      <PageHero eyebrow="Contact Us" title="Let’s talk about your project" />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <ul className="space-y-6">
          <ContactRow icon={BuildingOfficeIcon} label="Corporate Office">
            {COMPANY.corporateOffice}
          </ContactRow>
          <ContactRow icon={MapPinIcon} label="Registered Address">
            {COMPANY.registeredAddress}
          </ContactRow>
          <ContactRow icon={PhoneIcon} label="Phone">
            {COMPANY.phones.map((phone) => (
              <a key={phone} href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="block hover:text-brand-600">
                {phone}
              </a>
            ))}
          </ContactRow>
          <ContactRow icon={EnvelopeIcon} label="Email">
            <a href={`mailto:${COMPANY.email}`} className="hover:text-brand-600">
              {COMPANY.email}
            </a>
          </ContactRow>
        </ul>
        <iframe
          title="Map of the corporate office"
          src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
          className="h-80 w-full rounded-2xl border border-gray-200 lg:h-full lg:min-h-96"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </>
  );
}

function ContactRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof PhoneIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <div className="mt-1 leading-7 text-gray-900">{children}</div>
      </div>
    </li>
  );
}
