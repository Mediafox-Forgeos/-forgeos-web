'use client';

import {
  Archive,
  CheckCircle2,
  LoaderCircle,
  Save,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState, useTransition, type ReactNode } from 'react';
import {
  reviewMemoryAction,
  saveBrandBrainAction,
  type SaveBrainState,
} from '@/app/(app)/brand-brain/actions';
import {
  MEMORY_KIND_LABEL,
  MEMORY_STATUS_LABEL,
  type MemoryDecision,
  type MemoryEntry,
} from '@/lib/brain/types';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<MemoryEntry['status'], string> = {
  proposed: 'bg-warning-bg text-warning-fg',
  validated: 'bg-success-bg text-success-fg',
  rejected: 'bg-critical-bg text-critical-fg',
  archived: 'bg-muted text-muted-foreground',
};

const dt = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});
const when = (iso: string | null | undefined) =>
  iso ? dt.format(Date.parse(iso)) : '—';

/**
 * Revisión humana de un aprendizaje propuesto (DS v0.4 · LearningReviewCard). Muestra la
 * evidencia, el autor y el estado; owner/admin aprueban, rechazan (con motivo obligatorio) o
 * archivan. Foxy nunca modifica la estrategia: la decisión es siempre de una persona.
 */
export function LearningReviewCard({
  entry,
  authorName,
  reviewerName,
  canReview,
  reviewMode,
  withPeriod,
}: {
  entry: MemoryEntry;
  authorName: string | null;
  reviewerName: string | null;
  canReview: boolean;
  /** full: aprobar, rechazar con motivo y archivar; basic: sin rechazo (falta 0008). */
  reviewMode: 'full' | 'basic' | 'none';
  /** Sufijo de consulta para enlaces internos (periodo). */
  withPeriod: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (decision: MemoryDecision) => {
    setError(null);
    if (decision === 'rejected' && note.trim().length < 3) {
      setError('Escribe el motivo del rechazo (mínimo 3 caracteres).');
      return;
    }
    start(async () => {
      const r = await reviewMemoryAction({ id: entry.id, decision, note });
      if ('error' in r) setError(r.error);
      else {
        setNote('');
        router.refresh();
      }
    });
  };
  const proposed = entry.status === 'proposed';
  const noteId = `nota-${entry.id}`;
  return (
    <article
      aria-labelledby={`mem-${entry.id}`}
      className="bg-card border-border/80 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="bg-ai-bg text-ai-fg rounded-full px-2 py-0.5 text-[11px] font-bold">
          {MEMORY_KIND_LABEL[entry.kind]}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-bold',
            STATUS_TONE[entry.status],
          )}
        >
          {MEMORY_STATUS_LABEL[entry.status]}
        </span>
        {entry.isSynthetic && (
          <span className="bg-warning-bg text-warning-fg rounded-full px-2 py-0.5 text-[11px] font-bold">
            Sintético
          </span>
        )}
      </div>
      <h3 id={`mem-${entry.id}`} className="mt-2 text-sm font-extrabold">
        {entry.title}
      </h3>
      <p className="text-muted-foreground mt-1 text-[13px] leading-snug">
        {entry.body}
      </p>
      {entry.evidence.length > 0 && (
        <details className="mt-2">
          <summary className="text-primary-text cursor-pointer text-[12px] font-extrabold">
            Evidencia ({entry.evidence.length})
          </summary>
          <ul className="mt-1 space-y-0.5 text-[12px]">
            {entry.evidence.map((e, i) => (
              <li key={i}>
                {e.href?.startsWith('/') ? (
                  <Link
                    href={`${e.href}${withPeriod}`}
                    className="text-primary-text underline-offset-2 hover:underline"
                  >
                    {e.label}
                  </Link>
                ) : (
                  e.label
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      <dl className="text-muted-foreground mt-3 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="inline font-bold">Propuesto por: </dt>
          <dd className="inline">
            {authorName ?? 'autor no registrado'} · {when(entry.createdAt)}
          </dd>
        </div>
        {!proposed && (
          <div>
            <dt className="inline font-bold">
              {MEMORY_STATUS_LABEL[entry.status]} por:{' '}
            </dt>
            <dd className="inline">
              {reviewerName ?? 'no registrado'} · {when(entry.reviewedAt)}
            </dd>
          </div>
        )}
        {entry.reviewNote && (
          <div className="sm:col-span-2">
            <dt className="inline font-bold">Motivo: </dt>
            <dd className="inline">{entry.reviewNote}</dd>
          </div>
        )}
      </dl>
      {canReview && reviewMode !== 'none' && entry.status !== 'archived' && (
        <div className="border-border mt-3 border-t pt-3">
          {proposed && (
            <>
              <label htmlFor={noteId} className="text-[12px] font-extrabold">
                Motivo o nota de la decisión
                <span className="text-muted-foreground font-semibold">
                  {' '}
                  (obligatorio para rechazar)
                </span>
              </label>
              <textarea
                id={noteId}
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={reviewMode !== 'full'}
                className="bg-card border-border focus-visible:ring-primary-text mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-60"
              />
            </>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {proposed && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => decide('validated')}
                  className="bg-success-bg text-success-fg border-success-fg/40 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
                >
                  <CheckCircle2 aria-hidden className="h-4 w-4" /> Aprobar
                </button>
                <button
                  type="button"
                  disabled={pending || reviewMode !== 'full'}
                  onClick={() => decide('rejected')}
                  title={
                    reviewMode !== 'full'
                      ? 'Rechazar con motivo requiere la migración 0008 (pendiente de GO)'
                      : undefined
                  }
                  className="border-critical-fg/40 text-critical-fg inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
                >
                  <XCircle aria-hidden className="h-4 w-4" /> Rechazar
                </button>
              </>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => decide('archived')}
              className="border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-extrabold disabled:opacity-60"
            >
              <Archive aria-hidden className="h-4 w-4" /> Archivar
            </button>
            {pending && (
              <LoaderCircle
                aria-label="Guardando decisión"
                className="h-4 w-4 animate-spin"
              />
            )}
          </div>
          {reviewMode === 'basic' && proposed && (
            <p className="text-muted-foreground mt-1.5 text-[11.5px]">
              Rechazar con motivo requiere la migración 0008 (preparada en
              local, pendiente de GO). Mientras tanto: aprobar o archivar.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="text-critical-fg mt-1.5 text-xs font-bold"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

/**
 * Formulario de Brand Brain con estado de guardado en la propia página (sin redirección):
 * conserva el periodo y los filtros, y confirma la versión guardada.
 */
export function BrandBrainForm({
  children,
  canEdit,
}: {
  children: ReactNode;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState<SaveBrainState, FormData>(
    saveBrandBrainAction,
    { status: 'idle' },
  );
  return (
    <form action={action} className="space-y-4">
      {children}
      {canEdit && (
        <div className="bg-background/90 border-border sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border p-2.5 backdrop-blur">
          <p
            role="status"
            aria-live="polite"
            className="mr-auto text-sm font-bold"
          >
            {state.status === 'saved' && (
              <span className="text-success-fg">
                Contexto guardado · versión {state.version} · {when(state.at)}
              </span>
            )}
            {state.status === 'error' && (
              <span className="text-critical-fg">{state.message}</span>
            )}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="bg-brand text-brand-foreground inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Save aria-hidden className="h-4 w-4" />
            )}
            {pending ? 'Guardando…' : 'Guardar contexto'}
          </button>
        </div>
      )}
    </form>
  );
}
