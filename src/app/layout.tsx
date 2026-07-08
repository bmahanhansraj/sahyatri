import type { Metadata, Viewport } from 'next';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Sahyatri — Share the road, share the ride',
  description: 'Carpooling & fleet mobility: pools, one-way rides and buses with verified drivers.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg', apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Sahyatri' },
};

export const viewport: Viewport = {
  themeColor: '#1A1508',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PwaRegister />
        <Nav />
        <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">{children}</main>
      </body>
    </html>
  );
}
