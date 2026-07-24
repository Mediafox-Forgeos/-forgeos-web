import type { Metadata } from 'next';
import './globals.css';
import { LabsSidebar } from '@/components/layout/labs-sidebar';

export const metadata: Metadata = {
  title: 'Forge Labs — MediaFOX Forge',
  description: 'AI-powered tools for founders, engineers, and product teams.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="flex h-screen overflow-hidden">
          <LabsSidebar />
          <main className="flex flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
