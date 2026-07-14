import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'ForgeOS',
  description: 'El sistema operativo de tu agencia.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body>{children}</body>
    </html>
  );
}
