'use client';

import { useActionState, useState } from 'react';
import { transitionIncidentAction } from '@/app/actions';
import { buttonCls } from '@/components/ui';
import { INCIDENT_LABEL, requiresResolutionSummary } from '@/lib/incidents/fsm';
import type { IncidentStatus } from '@/lib/types';

export function TransitionForm({
  incidentId,
  options,
}: {
  incidentId: string;
  options: IncidentStatus[];
}) {
  const [to, setTo] = useState<IncidentStatus>(options[0]!);
  const [state, action, pending] = useActionState(
    transitionIncidentAction,
    {} as { error?: string },
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="incidentId" value={incidentId} />
      <label className="block text-sm">
        Cambiar estado
        <select
          name="to"
          value={to}
          onChange={(e) => setTo(e.target.value as IncidentStatus)}
          className="bg-background mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {INCIDENT_LABEL[o]}
            </option>
          ))}
        </select>
      </label>
      {requiresResolutionSummary(to) && (
        <label className="block text-sm">
          Resumen de resolución (obligatorio)
          <textarea
            name="resolution"
            required
            minLength={5}
            rows={3}
            className="bg-background mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </label>
      )}
      {state.error && (
        <p role="alert" className="text-critical-fg text-sm">
          {state.error}
        </p>
      )}
      <button disabled={pending} className={buttonCls.primary}>
        {pending ? 'Guardando…' : 'Aplicar'}
      </button>
    </form>
  );
}
