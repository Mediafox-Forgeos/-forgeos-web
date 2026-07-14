import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/layout/demo-banner';
import { MovosSidebar } from '@/components/layout/movos-sidebar';

export function MovosShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background min-h-screen lg:flex">
      <MovosSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DemoBanner />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
