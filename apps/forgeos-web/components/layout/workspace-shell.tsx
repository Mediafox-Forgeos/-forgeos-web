import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/layout/app-sidebar';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background min-h-screen lg:flex">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
