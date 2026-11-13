import { notFound } from 'next/navigation';
import { assignIncidentAction, noteIncidentAction } from '@/app/actions';
import {
  Badge,
  Card,
  PageHeader,
  SeverityBadge,
  SyntheticTag,
  buttonCls,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { fmtDateTime } from '@/lib/format';
import {
  INCIDENT_LABEL,
  INCIDENT_TRANSITIONS,
  canManageIncidents,
} from '@/lib/incidents/fsm';
import { TransitionForm } from './transition-form';

export const metadata = { title: 'Incidente' };

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active, repo } = await requireContext();
  const [inc, members] = await Promise.all([
    repo.incident(active.organization.id, decodeURIComponent(id)),
    repo.members(active.organization.id),
  ]);
  if (!inc) notFound();
  const name = (uid: string | null) =>
    uid
      ? (members.find((m) => m.userId === uid)?.name ?? uid.slice(0, 8))
      : 'Sistema';
  const manage = canManageIncidents(active.role);
  const options = INCIDENT_TRANSITIONS[inc.status];
  const assignable = members.filter((m) => m.role !== 'viewer');

  return (
    <>
      <PageHeader
        layer="reputational"
        title={inc.title}
        actions={
          <div className="flex gap-2">
            <SeverityBadge s={inc.severity} />
            <Badge t="blue">{INCIDENT_LABEL[inc.status]}</Badge>
            {inc.isSynthetic && <SyntheticTag />}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-medium">Historial</h2>
          <ol className="mt-3 space-y-3 border-l pl-4">
            {inc.events.map((e) => (
              <li key={e.id} className="relative text-sm">
                <span
                  className="bg-brand absolute -left-[21px] top-1.5 h-2 w-2 rounded-full"
                  aria-hidden
                />
                <p>
                  <span className="font-medium">
                    {e.kind === 'opened' && 'Incidente abierto'}
                    {e.kind === 'status_changed' &&
                      `${INCIDENT_LABEL[e.fromStatus!]} → ${INCIDENT_LABEL[e.toStatus!]}`}
                    {e.kind === 'closed' &&
                      `Cierre: ${INCIDENT_LABEL[e.toStatus!]}`}
                    {e.kind === 'assigned' && `Asignado a ${name(e.body)}`}
                    {e.kind === 'note' && 'Nota'}
                    {e.kind === 'notified' && 'Notificación'}
                  </span>
                  <span className="text-muted-foreground">
                    {' '}
                    · {name(e.actor)} · {fmtDateTime(e.createdAt)}
                  </span>
                </p>
                {e.body && e.kind !== 'assigned' && (
                  <p className="text-muted-foreground mt-0.5">{e.body}</p>
                )}
              </li>
            ))}
          </ol>
          {manage && !['closed', 'false_positive'].includes(inc.status) && (
            <form action={noteIncidentAction} className="mt-4 space-y-2">
              <input type="hidden" name="incidentId" value={inc.id} />
              <label className="block text-sm">
                Agregar nota
                <textarea
                  name="body"
                  required
                  maxLength={2000}
                  rows={2}
                  className="bg-background mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                />
              </label>
              <button className={buttonCls.ghost}>Guardar nota</button>
            </form>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Responsable</dt>
                <dd>{inc.owner ? name(inc.owner) : 'Sin responsable'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Abierto</dt>
                <dd>{fmtDateTime(inc.openedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Cerrado</dt>
                <dd>{fmtDateTime(inc.closedAt)}</dd>
              </div>
              {inc.resolutionSummary && (
                <div>
                  <dt className="text-muted-foreground text-xs">Resolución</dt>
                  <dd>{inc.resolutionSummary}</dd>
                </div>
              )}
            </dl>
          </Card>
          {manage && options.length > 0 && (
            <Card className="space-y-4">
              <form action={assignIncidentAction} className="space-y-2">
                <input type="hidden" name="incidentId" value={inc.id} />
                <label className="block text-sm">
                  Responsable
                  <select
                    name="owner"
                    defaultValue={inc.owner ?? ''}
                    className="bg-background mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
                  >
                    {assignable.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={buttonCls.ghost}>Asignar</button>
              </form>
              <TransitionForm incidentId={inc.id} options={options} />
            </Card>
          )}
          {!manage && (
            <p className="text-muted-foreground text-xs">
              Tu rol ({active.role}) es de solo lectura.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
