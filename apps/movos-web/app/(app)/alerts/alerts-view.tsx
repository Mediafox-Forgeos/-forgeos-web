'use client';

import * as React from 'react';

import { DataTable, type Column } from '@/components/movos/data-table';
import {
  AlertSeverityBadge,
  AlertStatusBadge,
} from '@/components/movos/status-badge';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/format';
import type { Alert, AlertStatus } from '@/types';

export function AlertsView({ initialAlerts }: { initialAlerts: Alert[] }) {
  const [alerts, setAlerts] = React.useState(initialAlerts);

  const update = (id: string, status: AlertStatus) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === id ? { ...alert, status } : alert)),
    );
  };

  const columns: Column<Alert>[] = [
    { key: 'title', header: 'Alerta', render: (a) => a.title },
    {
      key: 'description',
      header: 'Detalle',
      render: (a) => (
        <span className="text-muted-foreground">{a.description}</span>
      ),
    },
    {
      key: 'severity',
      header: 'Severidad',
      render: (a) => <AlertSeverityBadge severity={a.severity} />,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (a) => <AlertStatusBadge status={a.status} />,
    },
    {
      key: 'created',
      header: 'Creada',
      render: (a) => formatRelative(a.createdAt),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (a) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={a.status !== 'OPEN'}
            onClick={() => update(a.id, 'ACKNOWLEDGED')}
          >
            Reconocer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={a.status === 'RESOLVED'}
            onClick={() => update(a.id, 'RESOLVED')}
          >
            Resolver
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <p className="text-muted-foreground mb-4 text-xs">
        Las acciones actualizan un estado de demostración en el navegador; no se
        persisten en ningún backend.
      </p>
      <DataTable columns={columns} rows={alerts} getRowKey={(a) => a.id} />
    </div>
  );
}
