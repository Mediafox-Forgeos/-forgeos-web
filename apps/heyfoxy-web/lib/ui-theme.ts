/**
 * Tema de interfaz durante la transición a la V2 (decisión D-1: el legado sigue
 * disponible como alternativa). Preferencia por usuario en la cookie `hf_ui`.
 * No es un control de seguridad: solo cambia la presentación.
 */
export const UI_THEMES = ['v2-light', 'v2-dark', 'legacy'] as const;
export type UiTheme = (typeof UI_THEMES)[number];

export const UI_COOKIE = 'hf_ui';
export const DEFAULT_UI_THEME: UiTheme = 'v2-light';

export const UI_THEME_LABEL: Record<UiTheme, string> = {
  'v2-light': 'Claro',
  'v2-dark': 'Oscuro',
  legacy: 'Clásico (V1)',
};

/** Cualquier valor desconocido o ausente vuelve al tema por defecto. */
export function parseUiTheme(value: string | null | undefined): UiTheme {
  return (UI_THEMES as readonly string[]).includes(value ?? '')
    ? (value as UiTheme)
    : DEFAULT_UI_THEME;
}

export const isV2 = (t: UiTheme) => t !== 'legacy';
