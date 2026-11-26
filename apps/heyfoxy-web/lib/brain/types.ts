import { z } from 'zod';

/**
 * Foxy Brand Brain — contexto estratégico autorizado de una marca (doc 21).
 * Lo escribe una persona (owner/admin); Foxy lo lee para personalizar análisis y
 * recomendaciones y NUNCA lo modifica. Sin contexto, Foxy lo dice en lugar de inventarlo.
 */
const text = (max: number) => z.string().trim().max(max).default('');
const list = (max: number, item = 200) =>
  z.array(z.string().trim().min(1).max(item)).max(max).default([]);

export const PillarSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: text(400),
  /** Palabras clave para reconocer el pilar en el copy (opcional). */
  keywords: list(20, 40),
});

export const CampaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(['active', 'past']).default('active'),
  concept: text(600),
  goals: text(600),
  audiences: text(400),
  keyMessages: text(600),
  channels: list(10, 40),
  results: text(800),
  learnings: text(800),
  startsOn: z.string().max(10).default(''),
  endsOn: z.string().max(10).default(''),
});

export const BrandContextSchema = z.object({
  identity: z
    .object({
      name: text(120),
      description: text(1200),
      industry: text(120),
      valueProposition: text(800),
      positioning: text(800),
      personality: text(400),
      tone: text(600),
      visualGuidelines: text(800),
      brandManualRef: text(300),
    })
    .default({}),
  strategy: z
    .object({
      marketing: text(1500),
      communication: text(1500),
      organic: text(1500),
      businessGoals: list(10),
      communicationGoals: list(10),
      pillars: z.array(PillarSchema).max(12).default([]),
      audiences: list(10, 300),
      consumerInsights: list(15, 300),
      kpis: list(12, 80),
      competitors: list(15, 80),
    })
    .default({}),
  campaigns: z.array(CampaignSchema).max(30).default([]),
});

export type BrandContext = z.infer<typeof BrandContextSchema>;
export type Pillar = z.infer<typeof PillarSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;

export interface StoredBrandContext {
  context: BrandContext;
  version: number;
  updatedAt: string | null;
  isSynthetic: boolean;
  /** Quién guardó la versión vigente (id de usuario), si se conoce. */
  updatedBy?: string | null;
}

export const emptyBrandContext = (): BrandContext =>
  BrandContextSchema.parse({});

/** Qué tan completo está el contexto para personalizar a Foxy (0–100) y qué falta. */
export function brandContextCompleteness(c: BrandContext): {
  score: number;
  missing: string[];
} {
  const checks: Array<[string, boolean]> = [
    ['Descripción de la marca', c.identity.description.length > 0],
    ['Tono de comunicación', c.identity.tone.length > 0],
    ['Objetivos de comunicación', c.strategy.communicationGoals.length > 0],
    ['Pilares de contenido', c.strategy.pillars.length > 0],
    ['Audiencias', c.strategy.audiences.length > 0],
    ['Indicadores prioritarios', c.strategy.kpis.length > 0],
    ['Estrategia orgánica', c.strategy.organic.length > 0],
    ['Campañas activas', c.campaigns.some((x) => x.status === 'active')],
  ];
  const ok = checks.filter(([, v]) => v).length;
  return {
    score: Math.round((ok / checks.length) * 100),
    missing: checks.filter(([, v]) => !v).map(([k]) => k),
  };
}

export const MemoryKindSchema = z.enum([
  'learning',
  'decision',
  'recommendation_accepted',
  'recommendation_dismissed',
  'test_result',
]);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = {
  learning: 'Aprendizaje',
  decision: 'Decisión estratégica',
  recommendation_accepted: 'Recomendación aceptada',
  recommendation_dismissed: 'Recomendación descartada',
  test_result: 'Resultado de prueba',
};

export type MemoryStatus = 'proposed' | 'validated' | 'rejected' | 'archived';

export const MEMORY_STATUS_LABEL: Record<MemoryStatus, string> = {
  proposed: 'Pendiente de revisión',
  validated: 'Aprobado',
  rejected: 'Rechazado',
  archived: 'Archivado',
};

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  title: string;
  body: string;
  evidence: Array<{ label: string; href?: string }>;
  sourcePostId: string | null;
  status: MemoryStatus;
  createdAt: string;
  isSynthetic: boolean;
  /** Autor de la propuesta (id de usuario), si se conoce. */
  createdBy?: string | null;
  /** Quién decidió (aprobó, rechazó o archivó) y cuándo. */
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  /** Motivo de la decisión (obligatorio al rechazar). */
  reviewNote?: string | null;
}

/** Decisión humana sobre una propuesta. */
export type MemoryDecision = 'validated' | 'rejected' | 'archived';

/** Transiciones permitidas (las mismas que impone la migración 0008 en la base). */
export function canTransition(from: MemoryStatus, to: MemoryDecision): boolean {
  if (from === 'proposed') return true;
  return (from === 'validated' || from === 'rejected') && to === 'archived';
}
