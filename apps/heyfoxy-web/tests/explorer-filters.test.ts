import { describe, expect, it } from 'vitest';
import { explorerQuery, parseExplorerFilters } from '@/lib/explorer-filters';

describe('filtros de Social Explorer', () => {
  it('conserva solo filtros válidos', () => {
    expect(
      parseExplorerFilters({
        q: ' app ',
        platform: 'instagram',
        orden: 'interacciones',
      }),
    ).toEqual({ q: 'app', platform: 'instagram', orden: 'interacciones' });
    expect(
      parseExplorerFilters({ platform: 'myspace', orden: '__proto__', q: '' }),
    ).toEqual({
      q: undefined,
      platform: undefined,
      orden: undefined,
    });
    expect(parseExplorerFilters({ q: 'x'.repeat(101) }).q).toBeUndefined();
  });
  it('serializa en orden estable y omite el orden por defecto', () => {
    expect(
      explorerQuery({ platform: 'x', q: 'cita & hora', orden: 'recientes' }),
    ).toBe('q=cita+%26+hora&platform=x');
    expect(explorerQuery({})).toBe('');
  });
});
