import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartCard } from '@/components/ds/charts';
import { AreaTrend, Donut } from '@/components/ds/charts-client';
import { FoxyMark } from '@/components/ds/foxy';
import { FoxyInsightPanel } from '@/components/ds/layout';
import { PostMedia, PostMetricsRow, mediaAlt } from '@/components/ds/post';
import { Delta } from '@/components/ds/primitives';
import { ComingSoonState, NotAvailableState } from '@/components/ds/states';
import { postStats } from '@/lib/insights';
import type { Post } from '@/lib/types';
import { Lightbulb } from 'lucide-react';

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

const base: Post = {
  id: 'p1',
  organizationId: 'org',
  platform: 'instagram',
  accountHandle: '@cuenta',
  body: 'Texto',
  permalink: 'https://example.invalid/p/1',
  publishedAt: '2026-11-14T10:00:00Z',
  isSynthetic: true,
  metrics: [
    {
      capturedAt: '2026-11-14T12:00:00Z',
      likes: 10,
      comments: 2,
      shares: null,
      views: null,
      reach: 300,
    },
  ],
};

describe('PostMedia: nunca inventa medios', () => {
  it('sin medios muestra el fallback y ninguna imagen', () => {
    const h = html(<PostMedia post={base} />);
    expect(h).toContain('Sin vista previa');
    expect(h).not.toContain('<img');
    expect(h).not.toContain('<video');
  });
  it('una foto: <img> con texto alternativo', () => {
    const p = {
      ...base,
      media: [{ kind: 'image' as const, url: 'https://cdn.invalid/a.jpg' }],
    };
    const h = html(<PostMedia post={p} />);
    expect(h).toContain('src="https://cdn.invalid/a.jpg"');
    expect(h).toContain(`alt="${mediaAlt(p, p.media[0]!, 0, 1)}"`);
    expect(h.toLowerCase()).toContain('referrerpolicy="no-referrer"');
  });
  it('un video: controles, sin reproducción automática ni precarga', () => {
    const p = {
      ...base,
      media: [
        {
          kind: 'video' as const,
          url: 'https://cdn.invalid/v.mp4',
          previewUrl: 'https://cdn.invalid/v.jpg',
          durationSec: 75,
        },
      ],
    };
    const h = html(<PostMedia post={p} />);
    expect(h).toContain('<video');
    expect(h).toContain('controls');
    expect(h).toContain('preload="none"');
    expect(h).not.toContain('autoplay');
    expect(h).toContain('1:15');
  });
  it('carrusel: varias diapositivas, contador y controles accesibles', () => {
    const p = {
      ...base,
      media: [1, 2, 3].map((n) => ({
        kind: 'image' as const,
        url: `https://cdn.invalid/${n}.jpg`,
      })),
    };
    const h = html(<PostMedia post={p} />);
    expect(h).toContain('aria-roledescription="carrusel"');
    expect(h.match(/aria-roledescription="diapositiva"/g)).toHaveLength(3);
    expect(h).toContain('1/3');
    expect(h).toContain('Medio siguiente');
  });
});

describe('PostMetricsRow', () => {
  it('métrica ausente se muestra como «—», nunca como 0', () => {
    const h = html(<PostMetricsRow stats={postStats(base)} />);
    expect(h).toContain('—');
    expect(h).toContain('300');
    expect(h).not.toMatch(/>0</);
  });
});

describe('Delta: regla «Sin base comparable»', () => {
  it('sin base comparable no muestra porcentaje', () => {
    const h = html(<Delta value={50} comparable={false} />);
    expect(h).toContain('Sin base comparable');
    expect(h).not.toContain('%');
  });
  it('con base muestra el signo y la dirección accesible', () => {
    const h = html(<Delta value={28} comparable />);
    expect(h).toContain('+28%');
    expect(h).toContain('Sube');
  });
});

describe('Gráficos accesibles', () => {
  it('ChartCard incluye siempre la tabla alternativa', () => {
    const h = html(
      <ChartCard
        title="T"
        table={{ caption: 'Datos de T', columns: ['A', 'B'], rows: [['x', 1]] }}
      >
        <div />
      </ChartCard>,
    );
    expect(h).toContain('<table');
    expect(h).toContain('<caption class="sr-only">Datos de T</caption>');
    expect(h).toContain('Ver datos en tabla');
  });
  it('AreaTrend: cada punto es enfocable y tiene etiqueta', () => {
    const h = html(
      <AreaTrend
        unit="conversaciones"
        points={[
          { label: '1 nov', value: 2 },
          { label: '2 nov', value: 5 },
        ]}
      />,
    );
    expect(h).toContain('aria-label="1 nov: 2 conversaciones"');
    expect(h).toContain('aria-label="2 nov: 5 conversaciones"');
  });
  it('Donut: leyenda con valores y porcentajes', () => {
    const h = html(
      <Donut
        centerValue="4"
        centerLabel="total"
        segments={[
          { key: 'a', label: 'Positivo', value: 1, color: 'chart-pos' },
          { key: 'b', label: 'Negativo', value: 3, color: 'chart-neg' },
        ]}
      />,
    );
    expect(h).toContain('25%');
    expect(h).toContain('75%');
  });
});

describe('Foxy y estados', () => {
  it('FoxyMark decorativo es aria-hidden; con etiqueta es role=img', () => {
    expect(html(<FoxyMark />)).toContain('aria-hidden="true"');
    expect(html(<FoxyMark label="Foxy" />)).toContain('role="img"');
  });
  it('el panel de Foxy declara su origen y cita evidencia', () => {
    const h = html(
      <FoxyInsightPanel
        findings={[
          {
            id: 'f',
            tone: 'ai',
            icon: Lightbulb,
            text: 'Hallazgo',
            basis: '3 de 10',
            evidence: [{ label: 'Ver', href: '/conversaciones' }],
          },
        ]}
      />,
    );
    expect(h).toContain('Generado por reglas');
    expect(h).toContain('href="/conversaciones"');
  });
  it('Próximamente y Sin datos disponibles', () => {
    expect(html(<ComingSoonState />)).toContain('Próximamente');
    expect(html(<NotAvailableState />)).toContain('Sin datos disponibles');
  });
});

describe('Medios de Metricool (fase D)', () => {
  it('video con solo miniatura: muestra la miniatura, sin reproductor', () => {
    const h = html(
      <PostMedia
        post={{
          ...base,
          media: [
            {
              kind: 'video',
              url: 'https://cdn.example/t.jpg',
              previewUrl: 'https://cdn.example/t.jpg',
              durationSec: 42,
              playable: false,
            },
          ],
        }}
      />,
    );
    expect(h).toContain('src="https://cdn.example/t.jpg"');
    expect(h).not.toContain('<video');
    expect(h).toContain('0:42');
  });
});
