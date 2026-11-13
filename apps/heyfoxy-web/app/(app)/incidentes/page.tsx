import Link from 'next/link';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SeverityBadge,
  SyntheticTag,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { fmtDateTime } from '@/lib/format';
import { INCIDENT_LABEL } from '@/lib/incidents/fsm';

export const metadata = { title: 'Incidentes' };

export default async function IncidentsPage() {
  const { active, repo } = await requireContext();
  const [incidents, members] = await Promise.all([
    repo.incidents(active.organization.id),
    repo.members(active.organization.id),
  ]);
  const name = (id: string | null) =>
    id
      ? (members.find((m) => m.userId === id)?.name ?? id.slice(0, 8))
      : 'Sin responsable';
  return (
    <>
      <PageHeader
        layer="reputational"
        title="Incidentes"
        description="Seguimiento con responsable, estado, historial y cierre documentado."
      />
      {incidents.length === 0 ? (
        <EmptyState title="Sin incidentes">
          Abre uno desde una alerta.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {incidents.map((i) => (
            <li key={i.id}>
              <Link
                href={`/incidentes/${encodeURIComponent(i.id)}`}
                className="block"
              >
                <Card className="hover:bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge s={i.severity} />
                    <Badge
                      t={
                        ['closed', 'false_positive', 'resolved'].includes(
                          i.status,
                        )
                          ? 'green'
                          : 'blue'
                      }
                    >
                      {INCIDENT_LABEL[i.status]}
                    </Badge>
                    {i.isSynthetic && <SyntheticTag />}
                    <span className="text-muted-foreground ml-auto text-xs">
                      Abierto {fmtDateTime(i.openedAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 font-medium">{i.title}</p>
                  <p className="text-muted-foreground text-xs">
                    Responsable: {name(i.owner)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
