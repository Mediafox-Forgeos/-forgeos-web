import { describe, expect, it } from 'vitest';
import {
  dailySentiment,
  dominantSentiment,
  periodTrend,
  postStats,
  sentimentBreakdown,
  topTopics,
} from '@/lib/insights';
import type { ConversationItem, Post, Sentiment } from '@/lib/types';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const H = 3_600_000;

function item(
  hoursAgo: number,
  sentiment: Sentiment | null,
  topics: string[] = [],
): ConversationItem {
  return {
    id: `i${hoursAgo}${sentiment}`,
    organizationId: 'o',
    kind: 'comment',
    platform: 'instagram',
    provider: 'demo',
    brand: null,
    body: 'x',
    authorDisplay: null,
    publishedAt: new Date(NOW - hoursAgo * H).toISOString(),
    permalink: null,
    isSynthetic: true,
    analysis: sentiment
      ? {
          sentiment,
          intent: 'other',
          topics,
          severity: 'info',
          confidence: 0.9,
          explanation: 'x',
          priorityScore: 10,
          layer: 'operational',
          reviewStatus: 'not_required',
          provider: 'heuristic',
          model: 'm',
        }
      : null,
  };
}

describe('insights', () => {
  it('sentimentBreakdown ignora lo no analizado y calcula % negativo', () => {
    const b = sentimentBreakdown([
      item(1, 'negative'),
      item(2, 'negative'),
      item(3, 'positive'),
      item(4, 'neutral'),
      item(5, null),
    ]);
    expect(b).toMatchObject({
      total: 4,
      negative: 2,
      positive: 1,
      neutral: 1,
      negativePct: 50,
    });
    expect(sentimentBreakdown([]).negativePct).toBe(0);
  });

  it('dailySentiment devuelve N días ordenados y cuenta por día', () => {
    const days = dailySentiment(
      [item(1, 'positive'), item(1, 'negative'), item(30, 'mixed')],
      3,
      NOW,
    );
    expect(days.map((d) => d.d)).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ]);
    expect(days[2]).toMatchObject({ pos: 1, neg: 1, other: 0 });
    expect(days[1]).toMatchObject({ other: 1 });
  });

  it('topTopics ordena por volumen', () => {
    const t = topTopics([
      item(1, 'negative', ['App']),
      item(2, 'negative', ['App', 'Espera']),
      item(3, 'positive', ['Espera']),
      item(4, 'positive', ['App']),
    ]);
    expect(t[0]).toEqual(['App', 3]);
    expect(t[1]).toEqual(['Espera', 2]);
  });

  it('periodTrend compara la semana actual con la anterior', () => {
    const tr = periodTrend(
      [
        item(10, 'negative'),
        item(20, 'positive'),
        item(24 * 8, 'positive'),
        item(24 * 9, 'positive'),
      ],
      7,
      NOW,
    );
    expect(tr.current.total).toBe(2);
    expect(tr.previous.total).toBe(2);
    expect(tr.negativeDelta).toBe(50);
    expect(tr.volumeDelta).toBe(0);
  });

  it('postStats detecta actividad inusual (≥ 2× entre mediciones)', () => {
    const p: Post = {
      id: 'p',
      organizationId: 'o',
      platform: 'instagram',
      accountHandle: null,
      body: null,
      permalink: null,
      publishedAt: null,
      isSynthetic: true,
      metrics: [
        {
          capturedAt: 'b',
          likes: 310,
          comments: 64,
          shares: 9,
          views: 1,
          reach: 1,
        },
        {
          capturedAt: 'a',
          likes: 120,
          comments: 18,
          shares: 4,
          views: 1,
          reach: 1,
        },
      ],
    };
    expect(postStats(p)).toMatchObject({
      interactions: 383,
      growth: 241,
      unusual: true,
    });
    expect(postStats({ ...p, metrics: [] })).toMatchObject({
      latest: null,
      interactions: 0,
      growth: null,
      unusual: false,
    });
  });

  it('dominantSentiment', () => {
    expect(
      dominantSentiment([
        item(1, 'negative'),
        item(2, 'negative'),
        item(3, 'positive'),
      ]),
    ).toBe('negative');
    expect(
      dominantSentiment([
        item(1, 'positive'),
        item(2, 'neutral'),
        item(3, 'neutral'),
      ]),
    ).toBe('neutral');
    expect(dominantSentiment([])).toBeNull();
  });
});
