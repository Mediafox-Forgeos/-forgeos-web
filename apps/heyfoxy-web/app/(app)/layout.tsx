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
  const { viewer, memberships, active } = await requireContext();
  const theme = await getUiTheme();
  const ctx = { viewer, memberships, active };
  if (!isV2(theme)) return <LegacyShell ctx={ctx}>{children}</LegacyShell>;
  return (
    <div data-theme={theme} className="hf-v2 min-h-screen">
      <LegacyShell ctx={ctx}>{children}</LegacyShell>
    </div>
  );
}
