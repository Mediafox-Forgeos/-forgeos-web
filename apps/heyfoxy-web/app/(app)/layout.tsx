import { AppShell } from '@/components/shell/app-shell';
import { requireContext } from '@/lib/auth/session';
import { getUiTheme } from '@/lib/shell';
import { isV2 } from '@/lib/ui-theme';
import { LegacyShell } from './legacy-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { viewer, memberships, active, repo } = await requireContext();
  const theme = await getUiTheme();
  const ctx = { viewer, memberships, active };
  if (!isV2(theme)) return <LegacyShell ctx={ctx}>{children}</LegacyShell>;
  // Contador del menú: las alertas se leen siempre dentro de la organización activa (y RLS).
  const pendingAlerts = (await repo.alerts(active.organization.id)).filter(
    (a) => a.reviewStatus === 'pending',
  ).length;
  return (
    <AppShell ctx={ctx} theme={theme} pendingAlerts={pendingAlerts}>
      {children}
    </AppShell>
  );
}
