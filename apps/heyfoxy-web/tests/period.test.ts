import { describe, expect, it } from 'vitest';
import { parsePeriod, periodDays, periodRange, withPeriod } from '@/lib/period';

describe('periodo (?periodo=)', () => {
  it('solo acepta 7d, 30d y 90d; lo demás vuelve a 7d', () => {
    expect(parsePeriod('30d')).toBe('30d');
    expect(parsePeriod('90d')).toBe('90d');
    for (const v of [undefined, null, '', '1y', '7', '__proto__', 'toString'])
      expect(parsePeriod(v)).toBe('7d');
    expect(periodDays('30d')).toBe(30);
  });
  it('conserva el periodo en los enlaces internos (salvo el por defecto)', () => {
    expect(withPeriod('/alertas', '7d')).toBe('/alertas');
    expect(withPeriod('/alertas', '30d')).toBe('/alertas?periodo=30d');
    expect(withPeriod('/conversaciones?q=x', '90d')).toBe(
      '/conversaciones?q=x&periodo=90d',
    );
    expect(withPeriod('/#foxy', '30d')).toBe('/?periodo=30d#foxy');
  });
  it('rango legible en la zona horaria de Bogotá', () => {
    const now = Date.parse('2026-11-14T15:00:00Z');
    expect(periodRange('7d', now)).toBe('8 nov – 14 nov 2026');
  });
});
