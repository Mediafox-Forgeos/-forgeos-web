'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';
import type { ReactNode } from 'react';

import { MovosShell } from '@/components/layout/movos-shell';
import { useAuth } from '@/context/auth-context';

/**
 * Layout for all authenticated MOVOS routes. Wraps content in the operator
 * shell (sidebar + demo banner). The login route lives outside this group and
 * therefore has no shell.
 *
 * Gates on AuthProvider's own `isLoading`/`currentUser` — previously this
 * layout rendered `children` (and every widget's first poll request) before
 * AuthProvider.restore() had any chance to finish, guaranteeing every
 * authenticated page mount raced an unauthenticated first request. Reuses
 * the existing auth state instead of introducing a second one.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, currentUser } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login');
    }
  }, [isLoading, currentUser, router]);

  if (isLoading || !currentUser) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
      </div>
    );
  }

  return <MovosShell>{children}</MovosShell>;
}
