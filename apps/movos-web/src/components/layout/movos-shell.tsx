'use client';

import type { ReactNode } from 'react';

import { DemoBanner } from '@/components/layout/demo-banner';
import { MovosSidebar } from '@/components/layout/movos-sidebar';
import { OrganizationSwitcher } from '@/components/organizations/organization-switcher';
import { useAuth } from '@/context/auth-context';

export function MovosShell({ children }: { children: ReactNode }) {
  const { needsOrganizationSelection } = useAuth();

  // DEC-022 Objective 3, Case B: a token with no bound organization (0 or
  // >1 ACTIVE memberships) must not render any organization-scoped screen
  // until the user makes an explicit selection.
  if (needsOrganizationSelection) {
    return <OrganizationSwitcher variant="list" />;
  }

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
