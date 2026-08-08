'use client';

import { Wifi, WifiOff, HelpCircle } from 'lucide-react';

import type { ApiConnectivitySummary } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CONNECTIVITY_STATUS_LABELS } from '@/components/movos/api-charging-status-badges';
import { formatNumber } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022). Labels come from
 * the shared CONNECTIVITY_STATUS_LABELS constant, not independently
 * hardcoded strings — WO-ARGOS-023 (Operational Consistency Hardening)
 * fixed this widget previously saying "Fuera de línea" for the same
 * ConnectivityStatus.OFFLINE value the rest of the app calls
 * "Desconectado." See docs/product/OPERATIONAL_VOCABULARY.md.
 */
export function ConnectivityWidget() {
  const { data, loading, error } = usePolledResource<ApiConnectivitySummary>(
    '/operator/connectivity',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectividad</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar la conectividad.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <Wifi
                className="mx-auto size-5 text-emerald-400"
                aria-hidden="true"
              />
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(data.online)}
              </p>
              <p className="text-muted-foreground text-xs">
                {CONNECTIVITY_STATUS_LABELS.ONLINE}
              </p>
            </div>
            <div>
              <WifiOff
                className="mx-auto size-5 text-red-400"
                aria-hidden="true"
              />
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(data.offline)}
              </p>
              <p className="text-muted-foreground text-xs">
                {CONNECTIVITY_STATUS_LABELS.OFFLINE}
              </p>
            </div>
            <div>
              <HelpCircle
                className="text-muted-foreground mx-auto size-5"
                aria-hidden="true"
              />
              <p className="mt-2 text-lg font-semibold">
                {formatNumber(data.unknown)}
              </p>
              <p className="text-muted-foreground text-xs">
                {CONNECTIVITY_STATUS_LABELS.UNKNOWN}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
