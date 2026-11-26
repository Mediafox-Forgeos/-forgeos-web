import { describe, expect, it } from 'vitest';
import { mapMetricoolPost } from '@/lib/connectors/metricool';
import { applicableMetrics } from '@/lib/metrics-applicability';

describe('Métricas que no aplican al tipo de contenido (nunca «0» inventado)', () => {
  it('foto de Facebook: sin vistas ni reproducciones; conserva impresiones únicas', () => {
    const m = applicableMetrics(
      { views: 0, videoViews: 0, impressionsUnique: 37 },
      'facebook',
      'carousel',
    );
    expect(m).toEqual({ views: null, videoViews: null, impressionsUnique: 37 });
  });
  it('carrusel de Instagram: conserva vistas reales, sin reproducciones de video', () => {
    expect(
      applicableMetrics({ views: 429, videoViews: 0 }, 'instagram', 'carousel'),
    ).toEqual({ views: 429, videoViews: null });
  });
  it('reel y video: sin cambios', () => {
    expect(
      applicableMetrics({ views: 5, videoViews: 5 }, 'facebook', 'video'),
    ).toEqual({ views: 5, videoViews: 5 });
  });
  it('sin tipo conocido (sintéticos): sin cambios', () => {
    expect(
      applicableMetrics({ views: 0, videoViews: 0 }, 'facebook', null),
    ).toEqual({ views: 0, videoViews: 0 });
  });
  it('el conector ya no guarda reproducciones 0 para una foto de Facebook', () => {
    const p = mapMetricoolPost('facebook', {
      postId: '1',
      type: 'photo',
      views: 0,
      videoViews: 0,
      impressionsUnique: 42,
      link: 'https://facebook.com/1',
    });
    expect(p.metrics.views ?? null).toBeNull();
    expect(p.metrics.videoViews ?? null).toBeNull();
    expect(p.metrics.impressionsUnique).toBe(42);
  });
});
