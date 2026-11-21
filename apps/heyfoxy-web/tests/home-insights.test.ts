import { describe, expect, it } from 'vitest';
import {
  channelBreakdown,
  foxyFindings,
  inWindow,
  netSentiment,
  pctDelta,
  postTotals,
  ptsDelta,
} from '@/lib/home-insights';
import { sentimentBreakdown } from '@/lib/insights';
import type { Alert, ConversationItem, Post, Sentiment } from '@/lib/types';

const NOW = Date.parse('2026-11-14T15:00:00Z');
const H = 3_600_000;

let n = 0;
function item(
  hoursAgo: number,
  sentiment: Sentiment,
  topics: string[] = [],
  platform: ConversationItem['platform'] = 'instagram',
): ConversationItem {
  n++;
  return {
    id: `i${n}`,
    organizationId: 'org',
    kind: 'comment',
    platform,
    provider: 'demo',
    brand: null,
    body: 'x',
    authorDisplay: null,
    publishedAt: new Date(NOW - hoursAgo * H).toISOString(),
    permalink: null,
    isSynthetic: true,
    analysis: {
      sentiment,
      intent: 'other',
      topics,
      severity: 'info',
      confidence: 0.8,
      explanation: '',
      priorityScore: 10,
      layer: 'operational',
      reviewStatus: 'not_required',
      provider: 'heuristic',
      model: 'h',
    },
  };
}
const post = (hoursAgo: number, metrics: Post['metrics']): Post => ({
  id: `p${hoursAgo}`,
  organizationId: 'org',
  platform: 'instagram',
  accountHandle: '@c',
  body: 'b',
  permalink: null,
  publishedAt: new Date(NOW - hoursAgo * H).toISOString(),
  isSynthetic: true,
  metrics,
});
const m = (likes: number, reach: number | null) => ({
  capturedAt: '2026-11-14T00:00:00Z',
  likes,
  comments: 0,
  shares: 0,
  views: null,
  reach,
});

describe('ventanas y comparabilidad', () => {
  it('separa el periodo actual del anterior sin solaparlos', () => {
    const rows = [
      item(1, 'positive'),
      item(24 * 7 - 1, 'negative'),
      item(24 * 7 + 1, 'negative'),
      item(24 * 15, 'neutral'),
    ];
    expect(inWindow(rows, 7, NOW)).toHaveLength(2);
    expect(inWindow(rows, 7, NOW, 7)).toHaveLength(1);
  });
  it('sin base (anterior = 0) no hay porcentaje: regla «Sin base comparable»', () => {
    expect(pctDelta(10, 0)).toEqual({ value: null, comparable: false });
    expect(pctDelta(12, 10)).toEqual({ value: 20, comparable: true });
    expect(ptsDelta(5, -3, 0)).toEqual({ value: null, comparable: false });
    expect(ptsDelta(5, -3, 4)).toEqual({ value: 8, comparable: true });
  });
  it('sentimiento neto en puntos', () => {
    const b = sentimentBreakdown([
      item(1, 'positive'),
      item(1, 'negative'),
      item(1, 'negative'),
      item(1, 'neutral'),
    ]);
    expect(netSentiment(b)).toBe(25 - 50);
    expect(netSentiment(sentimentBreakdown([]))).toBe(0);
  });
});

describe('agregados', () => {
  it('reparto por red ordenado', () => {
    const r = channelBreakdown([
      item(1, 'positive', [], 'x'),
      item(1, 'positive', [], 'facebook'),
      item(1, 'positive', [], 'x'),
    ]);
    expect(r).toEqual([
      { platform: 'x', count: 2 },
      { platform: 'facebook', count: 1 },
    ]);
  });
  it('alcance null si ninguna publicación lo trae (no se inventa 0)', () => {
    expect(postTotals([post(1, [m(3, null)])])).toEqual({
      posts: 1,
      interactions: 3,
      reach: null,
    });
    expect(
      postTotals([post(1, [m(3, 100)]), post(2, [m(1, null)])]).reach,
    ).toBe(100);
  });
});

describe('hallazgos de Foxy (reglas)', () => {
  const alert = (
    severity: Alert['severity'],
    reviewStatus: Alert['reviewStatus'],
  ): Alert => ({
    id: `a-${severity}-${reviewStatus}`,
    organizationId: 'org',
    title: 'Señal crítica',
    summary: '',
    severity,
    priorityScore: 90,
    reviewStatus,
    createdAt: new Date(NOW).toISOString(),
    isSynthetic: true,
    itemIds: [],
    incidentId: null,
  });
  it('cada hallazgo trae base y evidencia enlazada', () => {
    const current = [
      item(1, 'negative', ['citas']),
      item(2, 'negative', ['citas']),
      item(3, 'positive', ['app']),
      item(4, 'positive', ['app']),
    ];
    const previous = [
      item(24 * 8, 'positive'),
      item(24 * 8, 'positive'),
      item(24 * 9, 'neutral'),
    ];
    const f = foxyFindings({
      current,
      previous,
      posts: [],
      alerts: [alert('critical', 'pending')],
    });
    expect(f.map((x) => x.kind)).toEqual([
      'critical_pending',
      'negative_rise',
      'negative_topic',
      'positive_topic',
    ]);
    for (const x of f) {
      expect(x.basis.length).toBeGreaterThan(0);
      expect(x.evidence.length).toBeGreaterThan(0);
    }
  });
  it('sin periodo anterior no afirma que algo «aumenta»', () => {
    const f = foxyFindings({
      current: [item(1, 'negative'), item(2, 'negative')],
      previous: [],
      posts: [],
      alerts: [],
    });
    expect(f.find((x) => x.kind === 'negative_rise')).toBeUndefined();
  });
  it('alertas ya revisadas o no críticas no generan hallazgo', () => {
    const f = foxyFindings({
      current: [],
      previous: [],
      posts: [],
      alerts: [alert('critical', 'confirmed'), alert('high', 'pending')],
    });
    expect(f).toEqual([]);
  });
  it('detecta actividad inusual de una publicación', () => {
    const p = post(5, [m(40, 1000), m(10, 500)]);
    const f = foxyFindings({
      current: [],
      previous: [],
      posts: [p],
      alerts: [],
    });
    expect(f[0]?.kind).toBe('unusual_post');
    expect(f[0]?.evidence[0]?.href).toBe('/publicaciones/p5');
  });
});
