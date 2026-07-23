import { NamingClient } from './_client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Naming Engine — Forge Labs',
  description:
    'Generate, score, and analyze technology brand names using the MediaFOX Naming Engine.',
};

export default function NamingPage() {
  return <NamingClient />;
}
