import type { Metadata } from 'next';

import { AuthProvider } from '@/context/auth-context';
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
