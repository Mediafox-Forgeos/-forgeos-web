import Link from 'next/link';
import { openIncidentAction, reviewAlertAction } from '@/app/actions';
import {
  Badge,
  Card,
  SeverityBadge,
  SyntheticTag,
  buttonCls,
} from '@/components/ui';
import { REVIEW_LABEL, fmtRelative } from '@/lib/format';
import type { Alert, Role } from '@/lib/types';
import { canManageIncidents, canReviewAlerts } from '@/lib/incidents/fsm';

export function AlertCard({ a, role }: { a: Alert; role: Role }) {
  const needsReview = a.reviewStatus === 'pending';
  const blocked = a.severity === 'critical' && a.reviewStatus !== 'confirmed';
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge s={a.severity} />
        <Badge
          t={
            needsReview
              ? 'amber'
              : a.reviewStatus === 'confirmed'
                ? 'green'
                : a.reviewStatus === 'dismissed'
                  ? 'neutral'
                  : 'neutral'
          }
        >
          {REVIEW_LABEL[a.reviewStatus]}
        </Badge>
        {a.isSynthetic && <SyntheticTag />}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          Prioridad {Math.round(a.priorityScore)} · {fmtRelative(a.createdAt)}
        </span>
      </div>
      <h3 className="mt-2 font-medium">{a.title}</h3>
      <p className="text-muted-foreground mt-1 text-sm">{a.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {needsReview && canReviewAlerts(role) && (
          <>
            <form action={reviewAlertAction}>
              <input type="hidden" name="alertId" value={a.id} />
              <button
                name="decision"
                value="confirmed"
                className={buttonCls.primary}
              >
                Confirmar alerta
              </button>
            </form>
            <form action={reviewAlertAction}>
              <input type="hidden" name="alertId" value={a.id} />
              <button
                name="decision"
                value="dismissed"
                className={buttonCls.ghost}
              >
                Descartar
              </button>
            </form>
          </>
        )}
        {a.incidentId ? (
          <Link
            href={`/incidentes/${encodeURIComponent(a.incidentId)}`}
            className={buttonCls.ghost}
          >
            Ver incidente
          </Link>
        ) : (
          canManageIncidents(role) &&
          a.reviewStatus !== 'dismissed' && (
            <form action={openIncidentAction}>
              <input type="hidden" name="alertId" value={a.id} />
              <button
                disabled={blocked}
                title={blocked ? 'Requiere revisión humana previa' : undefined}
                className={buttonCls.ghost}
              >
                Abrir incidente
              </button>
            </form>
          )
        )}
        {needsReview && !canReviewAlerts(role) && (
          <p className="text-muted-foreground text-xs">
            Pendiente de revisión por un analista.
          </p>
        )}
      </div>
    </Card>
  );
}
