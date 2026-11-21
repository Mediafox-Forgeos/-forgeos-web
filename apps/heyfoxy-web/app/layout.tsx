import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Nunito variable 400–900, subconjunto latino (incluye Latin-1: tildes, ñ, ¿, ¡).
// Autoalojada en el repositorio (OFL 1.1, app/fonts/OFL.txt): sin red en el build ni
// en runtime. Solo define la variable; la aplican las vistas V2 (`.hf-v2`).
const nunito = localFont({
  src: './fonts/Nunito-Variable-latin.woff2',
  weight: '400 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: { default: 'Hey Foxy', template: '%s · Hey Foxy' },
  description: 'Inteligencia social y reputacional multiempresa',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-CO" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
