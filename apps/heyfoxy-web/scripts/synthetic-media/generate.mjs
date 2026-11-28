// Genera las piezas publicitarias SINTÉTICAS de las organizaciones de prueba (GO-IA-3, HF-QA-08)
// a partir de pieces.json: diseño propio en HTML/SVG renderizado a JPEG con el Chromium de
// tools/heyfoxy-qa (fuera del workspace pnpm; no toca el lockfile compartido). Sin red, sin
// fotografías ni recursos de terceros, sin datos reales. Uso:
//   node apps/heyfoxy-web/scripts/synthetic-media/generate.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '../..');
const QA = path.resolve(APP, '../../tools/heyfoxy-qa');
const { chromium } = await import(
  path.join(QA, 'node_modules/@playwright/test/index.mjs')
);
const spec = JSON.parse(readFileSync(path.join(HERE, 'pieces.json'), 'utf8'));

const SIZE = {
  square: [1080, 1080],
  portrait: [1080, 1350],
  landscape: [1200, 630],
  story: [720, 1280],
};

// Iconos propios (trazos simples, sin recursos externos).
const ICON = {
  calendar:
    '<rect x="12" y="20" width="76" height="66" rx="10"/><path d="M12 40h76M32 10v18M68 10v18"/><path d="M30 58l10 10 22-22"/>',
  heart:
    '<path d="M50 84C20 62 10 46 10 32a20 20 0 0 1 40-6 20 20 0 0 1 40 6c0 14-10 30-40 52z"/><path d="M22 46h14l6-10 8 20 6-10h22"/>',
  stethoscope:
    '<path d="M26 12v28a20 20 0 0 0 40 0V12"/><path d="M46 60v8a18 18 0 0 0 36 0v-6"/><circle cx="82" cy="54" r="8"/>',
  shield:
    '<path d="M50 8l34 12v26c0 22-14 38-34 46C30 84 16 68 16 46V20z"/><path d="M34 48l12 12 22-24"/>',
  phone:
    '<rect x="28" y="6" width="44" height="88" rx="10"/><path d="M44 80h12"/><path d="M38 34l8 8 16-16"/>',
  drop: '<path d="M50 8C36 30 24 44 24 60a26 26 0 0 0 52 0C76 44 64 30 50 8z"/><path d="M38 62a12 12 0 0 0 12 12"/>',
  moon: '<path d="M70 70A34 34 0 0 1 36 16a36 36 0 1 0 34 54z"/><path d="M72 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
  clock: '<circle cx="50" cy="50" r="38"/><path d="M50 26v26l16 10"/>',
  chat: '<path d="M14 18h72v46H44L26 82V64H14z"/><path d="M30 36h40M30 48h26"/>',
  coins:
    '<ellipse cx="40" cy="30" rx="26" ry="10"/><path d="M14 30v14c0 6 12 10 26 10s26-4 26-10V30"/><ellipse cx="60" cy="62" rx="26" ry="10"/><path d="M34 62v14c0 6 12 10 26 10s26-4 26-10V62"/>',
  chart:
    '<path d="M12 86h76"/><rect x="18" y="52" width="14" height="30"/><rect x="42" y="36" width="14" height="46"/><rect x="66" y="18" width="14" height="64"/>',
  lock: '<rect x="18" y="42" width="64" height="46" rx="8"/><path d="M32 42V30a18 18 0 0 1 36 0v12"/><circle cx="50" cy="64" r="6"/>',
  piggy:
    '<path d="M20 52c0-18 16-30 34-30 14 0 24 6 30 14h8v16h-8c-2 6-6 10-10 12v12H62v-8H44v8H32V74c-8-4-12-12-12-22z"/><circle cx="66" cy="44" r="3"/><path d="M44 30h16"/>',
  card: '<rect x="8" y="22" width="84" height="56" rx="8"/><path d="M8 38h84M20 62h20"/>',
  house:
    '<path d="M12 48L50 14l38 34"/><path d="M22 40v46h56V40"/><rect x="42" y="58" width="16" height="28"/>',
};

const icon = (name, color, size) =>
  `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${ICON[name] ?? ICON.chart}</svg>`;

function html(org, p) {
  const c = spec[org].palette;
  const [w, h] = SIZE[p.format];
  const u = Math.min(w, h) / 100; // unidad relativa
  const big = p.format === 'landscape' ? 5.6 * u : 7.4 * u;
  const brand = spec[org].brand;
  const layouts = {
    question: `background: radial-gradient(circle at 80% 20%, ${c.accent}55, transparent 45%), linear-gradient(160deg, ${c.bg}, ${c.bg2});`,
    list: `background: linear-gradient(180deg, ${c.soft} 0 38%, ${c.bg} 38% 100%);`,
    scene: `background: linear-gradient(135deg, ${c.bg2}, ${c.bg} 60%, ${c.accent});`,
    split: `background: linear-gradient(90deg, ${c.accent} 0 34%, ${c.bg} 34% 100%);`,
    cta: `background: linear-gradient(200deg, ${c.bg}, ${c.bg2});`,
    video: `background: radial-gradient(circle at 30% 70%, ${c.accent}66, transparent 50%), linear-gradient(170deg, ${c.bg2}, ${c.bg});`,
  };
  const scene =
    p.layout === 'scene'
      ? `<svg class="scene" viewBox="0 0 200 120" preserveAspectRatio="xMidYMax slice"><circle cx="150" cy="30" r="18" fill="${c.accent}" opacity=".9"/><path d="M0 120V86c30-14 60-14 90 0s70 14 110-6v40z" fill="${c.soft}" opacity=".25"/><g fill="${c.soft}" opacity=".9"><circle cx="60" cy="58" r="10"/><path d="M42 104c0-18 8-30 18-30s18 12 18 30z"/><circle cx="96" cy="62" r="9"/><path d="M80 104c0-16 7-27 16-27s16 11 16 27z"/></g></svg>`
      : '';
  const carousel = p.carousel
    ? `<div class="dots">${Array.from({ length: p.carousel }, (_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><div class="badge">1/${p.carousel}</div>`
    : '';
  const video =
    p.layout === 'video'
      ? `<div class="play"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffffffdd"/><path d="M40 30l32 20-32 20z" fill="${c.bg2}"/></svg></div><div class="dur">▶ ${p.duration}</div>`
      : '';
  const darkText = p.layout === 'list';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${w}px;height:${h}px;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;${layouts[p.layout]}color:#fff;position:relative}
  .wrap{position:absolute;inset:${6 * u}px;display:flex;flex-direction:column;justify-content:${p.layout === 'list' ? 'flex-end' : 'center'};gap:${2.4 * u}px;${p.layout === 'split' ? `left:${w * 0.38}px;` : ''}}
  .kicker{font-size:${2.6 * u}px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:${p.layout === 'split' ? c.soft : c.accent}}
  h1{font-size:${big}px;line-height:1.05;font-weight:800;max-width:${p.layout === 'split' ? w * 0.56 : w * 0.82}px}
  p.sub{font-size:${3.2 * u}px;opacity:.92;max-width:${w * 0.7}px}
  .icon{position:absolute;${p.layout === 'split' ? `left:${w * 0.07}px;top:${h / 2 - 11 * u}px` : p.layout === 'list' || p.layout === 'video' ? `left:${6 * u}px;top:${6 * u}px` : `right:${6 * u}px;top:${(p.carousel ? 11 : 6) * u}px`}}
  .brand{position:absolute;left:${6 * u}px;bottom:${3 * u}px;font-size:${2.2 * u}px;font-weight:700;opacity:.95;color:${darkText ? '#fff' : '#fff'}}
  .synth{position:absolute;right:${3 * u}px;bottom:${3 * u}px;font-size:${1.7 * u}px;padding:${0.6 * u}px ${1.4 * u}px;border-radius:99px;background:#00000055}
  .cta{display:inline-block;margin-top:${1.6 * u}px;padding:${1.6 * u}px ${3.4 * u}px;border-radius:99px;background:${c.accent};color:${c.ink};font-weight:800;font-size:${3 * u}px;width:max-content}
  .scene{position:absolute;left:0;right:0;bottom:0;width:100%;height:55%}
  .dots{position:absolute;left:50%;transform:translateX(-50%);bottom:${8 * u}px;display:flex;gap:${1 * u}px}
  .dots i{width:${1.4 * u}px;height:${1.4 * u}px;border-radius:50%;background:#ffffff66}.dots i.on{background:#fff}
  .badge{position:absolute;right:${4 * u}px;top:${4 * u}px;background:#000000aa;padding:${0.8 * u}px ${1.6 * u}px;border-radius:99px;font-size:${2.2 * u}px}
  .play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${20 * u}px;height:${20 * u}px;opacity:.95}
  .dur{position:absolute;right:${4 * u}px;top:${4 * u}px;background:#000000aa;padding:${0.8 * u}px ${1.6 * u}px;border-radius:8px;font-size:${2.4 * u}px}
  ${p.layout === 'video' ? `.wrap{justify-content:flex-end;padding-bottom:${10 * u}px}` : ''}
  ${p.layout === 'list' ? `.wrap h1{color:#fff}` : ''}
  ${p.carousel ? `.wrap{padding-bottom:${7 * u}px}.dots{bottom:${4.2 * u}px}` : ''}
  </style></head><body>
  ${scene}
  <div class="icon">${icon(p.icon, p.layout === 'split' ? c.ink : p.layout === 'list' ? c.bg : c.soft, (p.layout === 'split' ? 22 : 16) * u)}</div>
  <div class="wrap"><div class="kicker">${p.kicker}</div><h1>${p.title}</h1><p class="sub">${p.sub}</p>${p.layout === 'cta' ? '<span class="cta">Agendar ahora</span>'.replace('Agendar ahora', org === 'aurora' ? 'Agendar ahora' : 'Empezar ahora') : ''}</div>
  ${carousel}${video}
  <div class="brand">${brand} · marca ficticia</div><div class="synth">Pieza sintética de prueba</div>
  </body></html>`;
}

const browser = await chromium.launch({ channel: 'chrome' });
let n = 0;
for (const org of ['aurora', 'horizonte']) {
  const out = path.join(APP, 'public/synthetic-media', org);
  mkdirSync(out, { recursive: true });
  for (const p of spec[org].pieces) {
    const [w, h] = SIZE[p.format];
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(html(org, p), { waitUntil: 'load' });
    await page.screenshot({
      path: path.join(out, `${p.file}.jpg`),
      type: 'jpeg',
      quality: 82,
    });
    await page.close();
    n++;
  }
}
await browser.close();
console.log(`piezas sintéticas generadas: ${n}`);
