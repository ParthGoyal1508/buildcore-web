import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | BuildCore',
    default: 'BuildCore',
  },
  description: 'BuildCore ERP — construction workforce, assets, and project management.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
