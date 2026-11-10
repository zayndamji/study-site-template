import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: auth.title,
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={auth.lang}>
      <body>{children}</body>
    </html>
  );
}
