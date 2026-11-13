import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INCIDENT_TRANSITIONS,
  canTransition,
  requiresResolutionSummary,
} from '@/lib/incidents/fsm';
import { planDispatch, type WaRecipient } from '@/lib/whatsapp/notifier';
import { WA_TEMPLATES, renderTemplate } from '@/lib/whatsapp/templates';
import { planIngestion } from '@/lib/ingestion/pipeline';
import {
  credentialAad,
  decryptSecret,
  encryptSecret,
  maskSecret,
} from '@/lib/security/credentials';
import { contentHash } from '@/lib/security/hash';
import { maskPhone } from '@/lib/mask';
import type { IncidentStatus } from '@/lib/types';

describe('FSM de incidentes', () => {
  it('coincide exactamente con la función SQL', () => {
    const sql = readFileSync(
      new URL(
        '../supabase/migrations/20261113000300_hf_intelligence_incidents.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const block = sql.slice(
      sql.indexOf('hf_incident_transition_allowed'),
      sql.indexOf('$$;', sql.indexOf('hf_incident_transition_allowed')),
    );
    const pairs = [...block.matchAll(/\('(\w+)','(\w+)'\)/g)]
      .map((m) => `${m[1]}>${m[2]}`)
      .sort();
    const ts = Object.entries(INCIDENT_TRANSITIONS)
      .flatMap(([f, ts]) => ts.map((t) => `${f}>${t}`))
      .sort();
    expect(ts).toEqual(pairs);
  });
  it('estados terminales y cierre documentado', () => {
    expect(canTransition('closed', 'open' as IncidentStatus)).toBe(false);
    expect(canTransition('open', 'resolved')).toBe(false);
    expect(requiresResolutionSummary('closed')).toBe(true);
  });
});

describe('WhatsApp 1:1', () => {
  const now = new Date().toISOString();
  const r = (o: Partial<WaRecipient>): WaRecipient => ({
    id: 'r',
    displayName: 'x',
    phoneE164: '+570000000001',
    minSeverity: 'high',
    optedInAt: now,
    optedOutAt: null,
    isActive: true,
    ...o,
  });
  const args = {
    mode: 'simulate' as const,
    alertId: 'a1',
    severity: 'critical' as const,
    template: 'hf_alerta_critica',
    values: ['Marca', 'Resumen', '90'],
  };
  it('envío real bloqueado en Gate 2', () => {
    expect(() =>
      planDispatch({
        ...args,
        mode: 'live',
        reviewConfirmed: true,
        recipients: [r({})],
      }),
    ).toThrow(/no autorizados/);
  });
  it('crítica sin revisión humana se suprime', () => {
    expect(
      planDispatch({ ...args, reviewConfirmed: false, recipients: [r({})] })[0]!
        .status,
    ).toBe('suppressed');
  });
  it('sin opt-in, dado de baja o bajo umbral => suprimido', () => {
    const out = planDispatch({
      ...args,
      severity: 'high',
      reviewConfirmed: true,
      recipients: [
        r({ id: 'a', optedInAt: null }),
        r({ id: 'b', optedOutAt: now }),
        r({ id: 'c', minSeverity: 'critical' }),
        r({ id: 'd' }),
      ],
    });
    expect(out.map((d) => d.status)).toEqual([
      'suppressed',
      'suppressed',
      'suppressed',
      'simulated',
    ]);
    expect(new Set(out.map((d) => d.idempotencyKey)).size).toBe(4);
  });
  it('plantillas: variables exactas', () => {
    expect(renderTemplate('hf_alerta_critica', ['M', 'R', '91'])).toContain(
      'Alerta crítica para M',
    );
    expect(() => renderTemplate('hf_alerta_critica', ['M'])).toThrow();
    expect(
      Object.values(WA_TEMPLATES).every((t) => t.category === 'UTILITY'),
    ).toBe(true);
  });
  it('teléfono enmascarado', () => {
    expect(maskPhone('+573001234567')).toBe('+57 ••• ••• 4567');
  });
});

describe('ingesta: duplicados y límites', () => {
  const c = (id: string, body: string, author = 'u') => ({
    externalId: id,
    parentExternalId: null,
    postExternalId: null,
    platform: 'instagram' as const,
    body,
    authorExternalId: author,
    authorDisplay: null,
    publishedAt: new Date().toISOString(),
    permalink: null,
  });
  it('descarta ids conocidos, repetidos y copias del mismo autor', () => {
    const p = planIngestion({
      incoming: [
        c('1', 'Hola!'),
        c('1', 'Hola!'),
        c('2', 'hola'),
        c('3', 'hola', 'otro'),
        c('4', 'nuevo'),
      ],
      knownExternalIds: new Set(['0']),
      knownHashesByAuthor: new Set(),
      itemsIngestedToday: 0,
      maxItemsPerDay: 100,
    });
    expect(p.accepted.map((a) => a.externalId)).toEqual(['1', '3', '4']);
    expect(p.duplicates).toBe(2);
  });
  it('respeta el límite diario', () => {
    const p = planIngestion({
      incoming: [c('1', 'a'), c('2', 'b'), c('3', 'c')],
      knownExternalIds: new Set(),
      knownHashesByAuthor: new Set(),
      itemsIngestedToday: 9,
      maxItemsPerDay: 10,
    });
    expect(p.accepted).toHaveLength(1);
    expect(p.overLimit).toBe(2);
  });
  it('hash normaliza tildes, mayúsculas, URLs y signos', () => {
    expect(contentHash('¡Pésimo servicio! https://x.co/a')).toBe(
      contentHash('pesimo   servicio'),
    );
  });
});

describe('credenciales cifradas', () => {
  const kek = Buffer.alloc(32, 7).toString('base64');
  it('cifra/descifra con AAD ligado a org y fuente', () => {
    const aad = credentialAad('org-a', 'src-1');
    const s = encryptSecret('tok-123', aad, kek);
    expect(s.ciphertext.toString('utf8')).not.toContain('tok-123');
    expect(decryptSecret(s, aad, kek)).toBe('tok-123');
  });
  it('rechaza uso con otra organización (swap)', () => {
    const s = encryptSecret('tok', credentialAad('org-a', 'src-1'), kek);
    expect(() =>
      decryptSecret(s, credentialAad('org-b', 'src-1'), kek),
    ).toThrow();
  });
  it('rechaza KEK ausente o inválida', () => {
    expect(() => encryptSecret('x', 'a', undefined)).toThrow();
    expect(() =>
      encryptSecret('x', 'a', Buffer.alloc(8).toString('base64')),
    ).toThrow();
  });
  it('enmascara secretos', () => {
    expect(maskSecret('abcdefghijkl')).toBe('••••ijkl');
    expect(maskSecret('short')).toBe('••••');
  });
});
