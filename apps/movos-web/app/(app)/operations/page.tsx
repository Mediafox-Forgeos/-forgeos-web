'use client';

import { ArrowRight } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { OperationalIntelligenceWidget } from '@/components/operator/operational-intelligence-widget';
import { OperationalActionsSection } from '@/components/operator/operational-actions-section';

const WORKFLOW_STEPS = ['Recomendación', 'Acción', 'Resolución'];

/**
 * Kylum Console — Screen 3, Operations (WO-ARGOS-030/031). "What needs
 * attention today?" The Recommendation Engine (WO-ARGOS-025) surfaces a
 * finding, the Action Center (WO-ARGOS-026) is where an operator works it —
 * the same real 5-transition state machine, promoted to a full screen
 * instead of a bottom-of-dashboard section. SLA timers, maintenance tickets,
 * technician identity, and full intervention history are named honestly as
 * not real yet — see docs/product/KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md
 * — rather than faked with mock data that would look load-bearing.
 */
export default function OperationsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS · Operaciones"
        title="Centro de operaciones"
        description="Qué necesita atención hoy."
      />

      <div className="border-border bg-accent/20 mt-8 flex items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm">
        {WORKFLOW_STEPS.map((step, i) => (
          <span key={step} className="flex items-center gap-3">
            <span
              className={
                i === 0
                  ? 'font-medium'
                  : i === WORKFLOW_STEPS.length - 1
                    ? 'font-medium text-emerald-400'
                    : 'text-movos-blue font-medium'
              }
            >
              {step}
            </span>
            {i < WORKFLOW_STEPS.length - 1 && (
              <ArrowRight
                className="text-muted-foreground size-4"
                aria-hidden="true"
              />
            )}
          </span>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em]">
          Recomendaciones activas
        </h2>
        <OperationalIntelligenceWidget />
      </section>

      <section className="mt-6">
        <OperationalActionsSection />
      </section>

      <Card className="mt-6">
        <CardContent className="text-muted-foreground space-y-1.5 p-5 text-xs">
          <p>
            <span className="text-foreground font-medium">
              Fuera de alcance de este prototipo:
            </span>{' '}
            temporizadores de SLA, tickets de mantenimiento independientes de
            una recomendación, identidad y ubicación de técnicos de campo, e
            historial completo de intervenciones por caso.
          </p>
          <p>
            Ninguno de estos existe todavía como modelo real en el backend — ver
            docs/product/KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md.
          </p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
