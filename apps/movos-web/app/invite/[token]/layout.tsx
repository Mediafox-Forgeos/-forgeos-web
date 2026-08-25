import type { ReactNode } from 'react';

/**
 * WO-ARGOS-089 — the public invitation-acceptance route has its own
 * centered layout with no sidebar or demo banner, same as /login.
 */
export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      {children}
    </div>
  );
}
