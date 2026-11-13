import { z } from 'zod';

export const PROMPT_VERSION = 'classify_item@2026-11-13.1';

/** Salida estructurada del clasificador (validada antes de persistir). */
export const ClassificationSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  intent: z.enum([
    'complaint',
    'question',
    'praise',
    'purchase_intent',
    'crisis_signal',
    'spam',
    'other',
  ]),
  topics: z.array(z.string().min(1).max(40)).max(5),
  severity: z.enum(['info', 'attention', 'high', 'critical']),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1).max(600),
  risk_flags: z
    .array(
      z.enum([
        'health_safety',
        'legal',
        'data_privacy',
        'threat',
        'discrimination',
        'fraud',
        'media_attention',
      ]),
    )
    .max(7)
    .default([]),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export interface ClassifyInput {
  organizationId: string;
  text: string;
  platform: string;
  brand: string | null;
  /** Señales de contexto para la prioridad (no se envían al modelo). */
  reach?: number;
}
