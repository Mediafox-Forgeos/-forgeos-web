import type { Metadata } from 'next';

import { MovosShell } from '@/components/layout/movos-shell';
import { tenant } from '@/config/tenant';

import './globals.css';

export const metadata: Metadata = {
  title: `${tenant.productName} · ${tenant.productDescriptor}`,
  description:
    'Sistema operativo de movilidad para infraestructura de carga de vehículos eléctricos.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={tenant.locale} className="dark">
      <body>
        <MovosShell>{children}</MovosShell>
      </body>
    </html>
  );
}
