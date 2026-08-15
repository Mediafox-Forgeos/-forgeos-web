'use client';

import { TriangleAlert } from 'lucide-react';

import type { ApiRecommendation } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { usePolledResource } from './use-polled-resource';
import { ActionButtons } from './action-buttons';
import { CreateWorkOrderFromRecommendationButton } from '../work-orders/create-from-recommendation-button';

// Exported for reuse by the Operational Actions section (WO-ARGOS-026) —
// one canonical severity vocabulary, not a second copy of these two maps.
export const severityLabel: Record<ApiRecommendation['severity'], string> = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
};

export const severityTone: Record<ApiRecommendation['severity'], BadgeTone> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
};

/**
 * Operational Intelligence MVP (WO-ARGOS-025) — the smallest possible
 * Recommendation Engine, surfaced as a dashboard widget. Exactly 5
 * recommendation types (docs/product/RECOMMENDATION_CATALOG.md #7, #9,
 * #8, #11, #20); the backend already caps this at one card per type, so
 * this component never needs to truncate a longer list itself — the
 * "maximum five cards" constraint holds by construction on the server.
 *
 * Each card now also carries acknowledge/assign/snooze/resolve/dismiss
 * controls (WO-ARGOS-026's Operational Execution Layer) — still no
 * Alert/Incident/MaintenanceTicket, and a recommendation whose Action was
 * never touched still disappears the moment its underlying condition
 * clears, exactly as it always did.
 */
export function OperationalIntelligenceWidget() {
  const { data, loading, error, refetch } = usePolledResource<
    ApiRecommendation[]
  >('/recommendations', 30_000);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inteligencia operativa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las recomendaciones.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No hay recomendaciones activas en este momento.
          </p>
        )}
        {data?.map((rec) => (
          <div
            key={rec.type}
            className="border-border rounded-lg border px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <TriangleAlert
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-sm font-semibold">{rec.title}</p>
              </div>
              <Badge tone={severityTone[rec.severity]}>
                {severityLabel[rec.severity]}
              </Badge>
            </div>

            <p className="text-muted-foreground mt-2 text-sm">
              {rec.explanation}
            </p>

            <ul className="mt-2 space-y-0.5">
              {rec.evidence.map((line, i) => (
                <li
                  key={i}
                  className="text-muted-foreground flex items-start gap-1.5 text-xs"
                >
                  <span aria-hidden="true">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs">
              <span className="font-medium">Acción sugerida: </span>
              {rec.recommendedAction}
            </p>

            {rec.stationId && (
              <ActionButtons
                recommendationType={rec.type}
                stationId={rec.stationId}
                action={rec.action}
                onChanged={refetch}
              />
            )}
            <CreateWorkOrderFromRecommendationButton recommendation={rec} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
