import { Card, PageHeader, Stat } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { canConfigure } from '@/lib/incidents/fsm';

export const metadata = { title: 'Uso y presupuestos' };

export default async function UsagePage() {
  const { active, repo } = await requireContext();
  if (!canConfigure(active.role))
    return <p className="text-muted-foreground text-sm">Solo owner/admin.</p>;
  const [u, sources] = await Promise.all([
    repo.usage(active.organization.id),
    repo.sources(active.organization.id),
  ]);
  const pct = (a: number, b: number) =>
    b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
  return (
    <>
      <PageHeader
        layer="platform"
        title="Uso y presupuestos"
        description="Límites de IA, ingesta y WhatsApp por organización. Al agotarse el presupuesto se usa el clasificador local (costo cero) o se detiene el análisis."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="IA este mes (USD)"
          value={`${u.aiMonthlyUsdSpent.toFixed(2)} / ${u.aiMonthlyUsdLimit}`}
          hint={`${pct(u.aiMonthlyUsdSpent, u.aiMonthlyUsdLimit)}% del límite`}
        />
        <Stat
          label="Items analizados hoy"
          value={`${u.aiDailyItemsUsed} / ${u.aiDailyItemsLimit}`}
        />
        <Stat
          label="Reutilizados por caché"
          value={u.cacheHits}
          hint="Duplicados sin costo"
        />
        <Stat
          label="WhatsApp (USD/mes)"
          value={`0.00 / ${u.whatsappMonthlyUsdLimit}`}
          hint="Simulación: sin costo"
        />
      </div>
      <Card className="mt-4">
        <p className="text-sm">
          Proveedor IA activo: <span className="font-mono">{u.provider}</span> ·
          modelo <span className="font-mono">{u.model}</span>
        </p>
        <h2 className="mt-4 text-sm font-medium">
          Límites de ingesta por fuente
        </h2>
        <ul className="mt-2 divide-y text-sm">
          {sources.map((s) => (
            <li key={s.id} className="flex justify-between py-2">
              <span>{s.displayName}</span>
              <span className="text-muted-foreground tabular-nums">
                {s.maxItemsPerDay.toLocaleString('es-CO')} items/día ·{' '}
                {s.ingestionPaused ? 'pausada' : 'activa'}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
