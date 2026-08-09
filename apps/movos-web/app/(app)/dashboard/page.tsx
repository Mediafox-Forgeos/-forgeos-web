import { redirect } from 'next/navigation';

/**
 * /dashboard was the accreted single-page operator view (demo executive
 * metrics + OperatorLive stacked on top of each other — see
 * docs/product/KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md's "the problem
 * this IA actually solves"). The Kylum Console (WO-ARGOS-030/031) replaces
 * it with four purposeful screens; /command-center is the new landing
 * screen. Kept as a real Next.js redirect, not a client-side push, mirroring
 * the same pattern already established for /stations -> /sites (WO-ARGOS-005)
 * so old bookmarks and links keep working.
 */
export default function DashboardPage(): never {
  redirect('/command-center');
}
