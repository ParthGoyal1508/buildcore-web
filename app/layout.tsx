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
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before React
          hydrates — a false-positive mismatch, not a real one. Scoped to
          this one element only; doesn't suppress genuine hydration bugs
          anywhere else in the tree. */}
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
