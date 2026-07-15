import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Bogotá Centro')).toBe('bogota-centro');
  });

  it('strips diacritics and symbols', () => {
    expect(slugify('Estación #1 — Medellín')).toBe('estacion-1-medellin');
  });

  it('collapses and trims separators', () => {
    expect(slugify('  Hello   World  ')).toBe('hello-world');
  });
});
