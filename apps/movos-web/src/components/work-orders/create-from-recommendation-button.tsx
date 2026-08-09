'use client';

import Link from 'next/link';
import * as React from 'react';
import { ClipboardPlus } from 'lucide-react';

import type { ApiRecommendation, ApiWorkOrder } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

/**
 * Work Order V1, Rule 2 (WO-ARGOS-035 / docs/operations/WORK_ORDER_AUTOMATIONS.md):
 * "Critical recommendation → allow operator to create WorkOrder." Not an
 * automation — a real button an operator clicks. Shown only for HIGH
 * severity, the real ceiling of RecommendationSeverity today (no CRITICAL
 * tier exists — see WORK_ORDER_AUTOMATIONS.md's open question on this).
 */
export function CreateWorkOrderFromRecommendationButton({
  recommendation,
}: {
  recommendation: ApiRecommendation;
}) {
  const [workOrderId, setWorkOrderId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (recommendation.severity !== 'HIGH' || !recommendation.stationId) {
    return null;
  }

  if (workOrderId) {
    return (
      <Link
        href={`/work-orders/${workOrderId}`}
        className="text-movos-blue mt-2 inline-flex items-center gap-1.5 text-xs hover:underline"
      >
        <ClipboardPlus className="size-3.5" /> Ver orden de trabajo
      </Link>
    );
  }

  async function create(): Promise<void> {
    setPending(true);
    try {
      const created = await apiClient.post<ApiWorkOrder>('/work-orders', {
        title: recommendation.title,
        description: recommendation.explanation,
        priority: 'HIGH',
        source: 'RECOMMENDATION',
        stationId: recommendation.stationId,
      });
      setWorkOrderId(created.id);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => void create()}
      className="mt-2"
    >
      <ClipboardPlus className="mr-1.5 size-3.5" />
      Crear orden de trabajo
    </Button>
  );
}
