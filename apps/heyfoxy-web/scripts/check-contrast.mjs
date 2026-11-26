#!/usr/bin/env node
// Verifica el contraste WCAG 2.2 AA de los temas V2 leyendo los tokens de app/globals.css.
// Texto ≥ 4,5:1; controles y gráficos ≥ 3:1 (1.4.11). Uso: node scripts/check-contrast.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(
  fileURLToPath(new URL('../app/globals.css', import.meta.url)),
  'utf8',
);

function block(theme) {
  const m = css.match(
    new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`),
  );
  if (!m) throw new Error(`Falta el bloque ${theme}`);
  const vars = {};
  for (const [, k, h, s, l] of m[1].matchAll(
    /--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g,
  ))
    vars[k] = [+h, +s / 100, +l / 100];
  return vars;
}

function rgb([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const lum = (c) =>
  rgb(c)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((acc, v, i) => acc + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const TEXT = 4.5;
const UI = 3;
const PAIRS = [
  ['foreground', 'background', TEXT],
  ['foreground', 'card', TEXT],
  ['foreground', 'muted', TEXT],
  ['muted-foreground', 'card', TEXT],
  ['muted-foreground', 'background', TEXT],
  ['muted-foreground', 'muted', TEXT],
  ['primary-text', 'card', TEXT],
  ['primary-text', 'background', TEXT],
  ['primary-text', 'primary-pale', TEXT],
  ['primary-text', 'mod-home', TEXT],
  ['brand-foreground', 'brand', TEXT],
  ['demo-foreground', 'demo', TEXT],
  ['foreground', 'mod-home', TEXT],
  ['muted-foreground', 'mod-home', TEXT],
  ['foreground', 'mod-explorer', TEXT],
  ['muted-foreground', 'mod-explorer', TEXT],
  ['success-fg', 'success-bg', TEXT],
  ['info-fg', 'info-bg', TEXT],
  ['warning-fg', 'warning-bg', TEXT],
  ['warning-fg', 'warning-soft', TEXT],
  ['critical-fg', 'critical-bg', TEXT],
  ['critical-strong', 'critical-soft', TEXT],
  ['high-fg', 'high-bg', TEXT],
  ['ai-fg', 'ai-bg', TEXT],
  ['success-fg', 'card', TEXT],
  ['critical-fg', 'card', TEXT],
  ['warning-fg', 'card', TEXT],
  ['info-fg', 'card', TEXT],
  ['control', 'card', UI],
  ['control', 'background', UI],
  ['brand', 'card', UI],
  ['chart-pos', 'card', UI],
  ['chart-neu', 'card', UI],
  ['chart-neg', 'card', UI],
  // Métricas e interacciones (WO-HF-V2-INTELLIGENCE-001): iconos, barras y anillo.
  ['metric-reach', 'card', UI],
  ['metric-engagement', 'card', UI],
  ['metric-impressions', 'card', UI],
  ['metric-interactions', 'card', UI],
  ['ix-likes', 'card', UI],
  ['ix-comments', 'card', UI],
  ['ix-shares', 'card', UI],
  ['ix-saves', 'card', UI],
  ['ix-reactions', 'card', UI],
];

let fails = 0;
for (const theme of ['v2-light', 'v2-dark']) {
  const v = block(theme);
  for (const [fg, bg, min] of PAIRS) {
    if (!v[fg] || !v[bg]) {
      console.log(`FALTA  ${theme}: --${fg} o --${bg}`);
      fails++;
      continue;
    }
    const r = ratio(v[fg], v[bg]);
    const ok = r >= min;
    if (!ok) fails++;
    console.log(
      `${ok ? 'ok   ' : 'FALLO'}  ${theme}  ${fg} / ${bg}  ${r.toFixed(2)}:1 (mín. ${min})`,
    );
  }
}
console.log(
  fails
    ? `\n${fails} pares por debajo de AA`
    : '\nContraste AA: todos los pares OK',
);
process.exit(fails ? 1 : 0);
