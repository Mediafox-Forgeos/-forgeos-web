import type { ReactNode } from 'react';

/**
 * The login route has its own centered layout with no sidebar or demo banner.
 */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      {children}
    </div>
  );
}
