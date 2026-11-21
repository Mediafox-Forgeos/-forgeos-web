import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_THEME, isV2, parseUiTheme } from '@/lib/ui-theme';

describe('preferencia de tema (hf_ui)', () => {
  it('acepta solo los temas conocidos', () => {
    expect(parseUiTheme('v2-light')).toBe('v2-light');
    expect(parseUiTheme('v2-dark')).toBe('v2-dark');
    expect(parseUiTheme('legacy')).toBe('legacy');
  });
  it('cualquier otro valor vuelve al tema por defecto', () => {
    for (const v of [
      undefined,
      null,
      '',
      'LEGACY',
      'v3',
      '<script>',
      'v2-light ',
    ]) {
      expect(parseUiTheme(v)).toBe(DEFAULT_UI_THEME);
    }
  });
  it('el legado no es V2', () => {
    expect(isV2('legacy')).toBe(false);
    expect(isV2('v2-dark')).toBe(true);
  });
});
