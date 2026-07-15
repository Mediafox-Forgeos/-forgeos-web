import type { ReactNode } from 'react';

import { MovosShell } from '@/components/layout/movos-shell';

/**
 * Layout for all authenticated MOVOS routes. Wraps content in the operator
 * shell (sidebar + demo banner). The login route lives outside this group and
 * therefore has no shell.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <MovosShell>{children}</MovosShell>;
}
