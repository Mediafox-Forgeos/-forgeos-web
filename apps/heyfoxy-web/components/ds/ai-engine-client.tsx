'use client';

import { LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { analyzePostGenerativeAction } from '@/app/(app)/foxy-actions';
import { AiStateNotice } from './ai-engine';

/**
 * Control del análisis generativo de una publicación (DS v0.5 · GenerativeAnalysisControl).
 * El análisis con IA tiene costo: se pide explícitamente, se reserva presupuesto y se guarda en
 * caché; si la publicación o el Brand Brain cambiaron, se ofrece actualizarlo. Estados: motor
 * local, IA disponible, generando, completado, desactualizado, respaldo con motivo y error.
 */
export function GenerativeAnalysisControl({
  postId,
  period,
  available,
  canRequest,
  hasResult,
  stale,
  unavailableReason,
}: {
  postId: string;
  period: string;
  available: boolean;
  canRequest: boolean;
  hasResult: boolean;
  stale: string | null;
  unavailableReason: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{
    tone: 'warning' | 'critical' | 'info';
    title: string;
    body: string;
  } | null>(null);
  if (!available)
    return (
      <p className="text-muted-foreground text-xs" data-ai-state="local">
        {unavailableReason}
      </p>
    );
  const run = () => {
    setNotice(null);
    start(async () => {
      const r = await analyzePostGenerativeAction({ postId, period });
      if ('error' in r) {
        setNotice({
          tone: 'critical',
          title: 'No se pudo solicitar el análisis',
          body: r.error,
        });
        return;
      }
      if (r.fallback && r.fallback.code !== 'not_enabled')
        setNotice({
          tone:
            r.fallback.code === 'provider_error' ||
            r.fallback.code === 'invalid_output'
              ? 'critical'
              : 'warning',
          title:
            r.fallback.code === 'budget'
              ? 'Presupuesto de IA agotado'
              : r.fallback.code === 'provider_error'
                ? 'Error del proveedor de IA'
                : 'Se usó el motor local por reglas',
          body: r.fallback.reason,
        });
      else if (r.cached)
        setNotice({
          tone: 'info',
          title: 'Sin cambios desde el último análisis',
          body: 'Se reutilizó el análisis guardado (sin costo).',
        });
      // Solo hay algo nuevo que mostrar si respondió la IA generativa (o la caché).
      if (r.engine !== 'local') router.refresh();
    });
  };
  const label = pending
    ? 'Generando análisis…'
    : stale
      ? 'Actualizar análisis con IA'
      : hasResult
        ? null
        : 'Analizar con IA generativa';
  return (
    <div
      className="space-y-2"
      data-ai-state={
        pending
          ? 'generating'
          : hasResult
            ? stale
              ? 'stale'
              : 'completed'
            : 'available'
      }
    >
      {stale && !pending && (
        <AiStateNotice tone="warning" title="Análisis desactualizado">
          {stale}
        </AiStateNotice>
      )}
      {label && (
        <button
          type="button"
          onClick={run}
          disabled={pending || !canRequest}
          title={
            !canRequest
              ? 'Tu rol no puede solicitar análisis con IA generativa'
              : undefined
          }
          className="bg-brand text-brand-foreground inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold disabled:opacity-60"
          aria-live="polite"
        >
          {pending ? (
            <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
          ) : stale ? (
            <RefreshCw aria-hidden className="h-4 w-4" />
          ) : (
            <Sparkles aria-hidden className="h-4 w-4" />
          )}
          {label}
        </button>
      )}
      {!canRequest && (
        <p className="text-muted-foreground text-[11.5px]">
          Solo owner, admin o analyst pueden solicitar análisis con costo.
        </p>
      )}
      {notice && (
        <AiStateNotice tone={notice.tone} title={notice.title}>
          {notice.body}
        </AiStateNotice>
      )}
    </div>
  );
}
