import 'server-only';
import { randomUUID } from 'node:crypto';
import { dataMode } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import {
  BrandContextSchema,
  emptyBrandContext,
  type BrandContext,
  type MemoryEntry,
  type MemoryKind,
  type StoredBrandContext,
} from './types';

/**
 * Almacén de Foxy Brand Brain.
 *  - Demo: en memoria del proceso, con un contexto SINTÉTICO de prueba para la organización
 *    demo (marcado como tal). Ninguna marca real.
 *  - Supabase: tablas de 0007 con la sesión del usuario (RLS decide quién lee y edita). Sin
 *    0007 aplicada (HF_MIGRATION_0007_APPLIED) el módulo informa que está pendiente.
 */
export type BrainAvailability = 'ready' | 'needs_migration';

export function brainAvailability(): BrainAvailability {
  if (dataMode() === 'demo') return 'ready';
  return process.env.HF_MIGRATION_0007_APPLIED === 'true'
    ? 'ready'
    : 'needs_migration';
}

// --- Demo ------------------------------------------------------------------------------------
const DEMO_ORG = '00000000-0000-4000-a000-0000000000a1';
// En el proceso de Next, las acciones y las páginas pueden cargar instancias distintas de este
// módulo: el estado de la demo se comparte en globalThis (solo modo demo, nunca datos reales).
const g = globalThis as unknown as {
  __hfBrainDemo?: {
    contexts: Map<string, StoredBrandContext>;
    memory: Map<string, MemoryEntry[]>;
  };
};
g.__hfBrainDemo ??= { contexts: new Map(), memory: new Map() };
const demoContexts = g.__hfBrainDemo.contexts;
const demoMemory = g.__hfBrainDemo.memory;

function demoSeed(orgId: string): StoredBrandContext | null {
  if (orgId !== DEMO_ORG) return null;
  return {
    isSynthetic: true,
    version: 1,
    updatedAt: null,
    context: BrandContextSchema.parse({
      identity: {
        name: 'Clínica Aurora (ficticia)',
        description:
          '[SINTÉTICO] Red de clínicas de ejemplo para probar Foxy Brand Brain. No es una marca real.',
        industry: 'Salud (ejemplo)',
        tone: 'Cercano, claro y empático; sin tecnicismos.',
        personality: 'Confiable, humana, preventiva.',
      },
      strategy: {
        organic:
          'Educar en prevención con piezas breves y útiles; reforzar confianza en la atención.',
        communicationGoals: [
          'Aumentar el alcance de contenidos de prevención',
          'Generar conversación útil en redes',
        ],
        pillars: [
          {
            name: 'Prevención',
            description: 'Hábitos y chequeos preventivos.',
            keywords: ['prevenci', 'chequeo', 'cuidar', 'salud'],
          },
          {
            name: 'Experiencia del paciente',
            description: 'Atención, citas y servicio.',
            keywords: ['cita', 'atención', 'servicio', 'agenda'],
          },
        ],
        audiences: ['Familias jóvenes', 'Adultos de 35 a 55 años'],
        kpis: ['Alcance', 'Engagement', 'Guardados'],
      },
      campaigns: [
        {
          name: 'Mes de la prevención (ficticia)',
          status: 'active',
          concept: 'Pequeños hábitos, grandes cambios.',
          goals: 'Alcance y guardados de piezas educativas.',
        },
      ],
    }),
  };
}

// --- API -------------------------------------------------------------------------------------
export async function getBrandContext(
  orgId: string,
): Promise<StoredBrandContext | null> {
  if (dataMode() === 'demo') {
    if (!demoContexts.has(orgId)) {
      const seed = demoSeed(orgId);
      if (seed) demoContexts.set(orgId, seed);
    }
    return demoContexts.get(orgId) ?? null;
  }
  if (brainAvailability() !== 'ready') return null;
  const db = await supabaseServer();
  const { data, error } = await db
    .from('brand_contexts')
    .select('identity, strategy, campaigns, version, updated_at, is_synthetic')
    .eq('organization_id', orgId)
    .maybeSingle();
  if (error) throw new Error('No se pudo leer el contexto de marca');
  if (!data) return null;
  return {
    context: BrandContextSchema.parse({
      identity: data.identity,
      strategy: data.strategy,
      campaigns: data.campaigns,
    }),
    version: data.version,
    updatedAt: data.updated_at,
    isSynthetic: data.is_synthetic,
  };
}

/** Guarda el contexto validado (la RLS exige owner/admin en Supabase). */
export async function saveBrandContext(
  orgId: string,
  input: unknown,
): Promise<StoredBrandContext> {
  const context = BrandContextSchema.parse(input);
  if (dataMode() === 'demo') {
    const prev = demoContexts.get(orgId);
    const next: StoredBrandContext = {
      context,
      version: (prev?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      isSynthetic: true,
    };
    demoContexts.set(orgId, next);
    return next;
  }
  if (brainAvailability() !== 'ready')
    throw new Error('Foxy Brand Brain requiere la migración 0007');
  const db = await supabaseServer();
  const { data, error } = await db
    .from('brand_contexts')
    .upsert(
      {
        organization_id: orgId,
        identity: context.identity,
        strategy: context.strategy,
        campaigns: context.campaigns,
      },
      { onConflict: 'organization_id' },
    )
    .select('version, updated_at, is_synthetic')
    .single();
  if (error) throw new Error('No se pudo guardar el contexto de marca');
  return {
    context,
    version: data.version,
    updatedAt: data.updated_at,
    isSynthetic: data.is_synthetic,
  };
}

export async function listMemory(orgId: string): Promise<MemoryEntry[]> {
  if (dataMode() === 'demo') return demoMemory.get(orgId) ?? [];
  if (brainAvailability() !== 'ready') return [];
  const db = await supabaseServer();
  const { data, error } = await db
    .from('brand_memory')
    .select(
      'id, kind, title, body, evidence, source_post_id, status, created_at, is_synthetic',
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error('No se pudo leer la memoria estratégica');
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    evidence: r.evidence ?? [],
    sourcePostId: r.source_post_id,
    status: r.status,
    createdAt: r.created_at,
    isSynthetic: r.is_synthetic,
  }));
}

/** Propone una entrada de memoria (queda «propuesta» hasta validación humana). */
export async function proposeMemory(
  orgId: string,
  entry: {
    kind: MemoryKind;
    title: string;
    body: string;
    evidence: Array<{ label: string; href?: string }>;
    sourcePostId: string | null;
    isSynthetic: boolean;
  },
): Promise<void> {
  const title = entry.title.trim().slice(0, 200);
  const body = entry.body.trim().slice(0, 4000);
  if (title.length < 3 || !body) throw new Error('Aprendizaje incompleto');
  if (dataMode() === 'demo') {
    const list = demoMemory.get(orgId) ?? [];
    list.unshift({
      id: randomUUID(),
      ...entry,
      title,
      body,
      status: 'proposed',
      createdAt: new Date().toISOString(),
    });
    demoMemory.set(orgId, list.slice(0, 50));
    return;
  }
  if (brainAvailability() !== 'ready')
    throw new Error('La memoria estratégica requiere la migración 0007');
  const db = await supabaseServer();
  const { error } = await db.from('brand_memory').insert({
    organization_id: orgId,
    kind: entry.kind,
    title,
    body,
    evidence: entry.evidence.slice(0, 10),
    source_post_id: entry.sourcePostId,
    is_synthetic: entry.isSynthetic,
  });
  if (error) throw new Error('No se pudo guardar el aprendizaje');
}

export const emptyContext = emptyBrandContext;
export type { BrandContext };
