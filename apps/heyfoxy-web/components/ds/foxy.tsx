import { cn } from '@/lib/cn';

/**
 * Foxy — mascota de Hey Foxy. SVG original (decisión 4): cabeza de zorro geométrica
 * con colores de tokens, válida en claro y oscuro. El PNG del concepto es solo referencia.
 *
 * - `mark`: la cabeza sola (16–24 px), junto a «Foxy IA» o el logotipo.
 * - `avatar`: la cabeza sobre un disco tonal (32–48 px), en paneles de Foxy.
 * - `illustration`: cabeza con destello de IA (saludo de Inicio).
 */
type Variant = 'mark' | 'avatar' | 'illustration';

const FUR = 'hsl(var(--foxy-fur))';
const FUR_DARK = 'hsl(var(--foxy-fur-dark))';
const CREAM = 'hsl(var(--foxy-cream))';
const INK = 'hsl(var(--foxy-ink))';

/** Trazados compartidos con app/icon.svg (mantener sincronizados). */
export const FOXY_PATHS = {
  earL: 'M9 27 15.5 5.5 28 17.5Z',
  earR: 'M55 27 48.5 5.5 36 17.5Z',
  earInL: 'M13.5 22.5 16.6 11.4 23.4 17.6Z',
  earInR: 'M50.5 22.5 47.4 11.4 40.6 17.6Z',
  head: 'M7.5 28C7.5 20.6 12.6 16.4 19.2 16.4c4.6 0 8.6 1.9 12.8 4.5 4.2-2.6 8.2-4.5 12.8-4.5 6.6 0 11.7 4.2 11.7 11.6 0 12.2-10.4 22.9-24.5 30.5C17.9 50.9 7.5 40.2 7.5 28Z',
  face: 'M13.2 33.4c5.4-.9 11.3 2.2 18.8 10.6 7.5-8.4 13.4-11.5 18.8-10.6-2.6 9.4-9.8 17.4-18.8 22.9-9-5.5-16.2-13.5-18.8-22.9Z',
  nose: 'M28.6 45.2h6.8c.6 0 .9.7.5 1.1l-3.4 3.5a.7.7 0 0 1-1 0l-3.4-3.5c-.4-.4-.1-1.1.5-1.1Z',
};

function Head() {
  return (
    <g>
      <path d={FOXY_PATHS.earL} fill={FUR_DARK} />
      <path d={FOXY_PATHS.earR} fill={FUR_DARK} />
      <path d={FOXY_PATHS.earInL} fill={INK} opacity={0.85} />
      <path d={FOXY_PATHS.earInR} fill={INK} opacity={0.85} />
      <path d={FOXY_PATHS.head} fill={FUR} />
      <path d={FOXY_PATHS.face} fill={CREAM} />
      <ellipse cx="23.2" cy="31.4" rx="2.7" ry="3.1" fill={INK} />
      <ellipse cx="40.8" cy="31.4" rx="2.7" ry="3.1" fill={INK} />
      <circle cx="24.1" cy="30.3" r="0.9" fill={CREAM} />
      <circle cx="41.7" cy="30.3" r="0.9" fill={CREAM} />
      <path d={FOXY_PATHS.nose} fill={INK} />
    </g>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const d = `M${x} ${y - s}C${x + s * 0.18} ${y - s * 0.18} ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y}C${x + s * 0.18} ${y + s * 0.18} ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}C${x - s * 0.18} ${y + s * 0.18} ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y}C${x - s * 0.18} ${y - s * 0.18} ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z`;
  return <path d={d} fill="hsl(var(--accent-2))" />;
}

export function FoxyMark({
  variant = 'mark',
  size = 24,
  label,
  className,
}: {
  variant?: Variant;
  size?: number;
  /** Si se indica, la imagen es significativa (role="img"); si no, decorativa. */
  label?: string;
  className?: string;
}) {
  const a11y = label
    ? { role: 'img' as const, 'aria-label': label }
    : { 'aria-hidden': true as const };
  if (variant === 'avatar')
    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={cn('shrink-0', className)}
        {...a11y}
      >
        <circle cx="32" cy="32" r="32" fill="hsl(var(--primary-pale))" />
        <g transform="translate(7.5 6) scale(0.77)">
          <Head />
        </g>
      </svg>
    );
  if (variant === 'illustration')
    return (
      <svg
        viewBox="0 0 96 72"
        width={(size * 96) / 72}
        height={size}
        className={cn('shrink-0', className)}
        {...a11y}
      >
        <ellipse
          cx="40"
          cy="66"
          rx="24"
          ry="3.5"
          fill="hsl(var(--shadow) / 0.08)"
        />
        <g transform="translate(8 2)">
          <Head />
        </g>
        <Sparkle x={80} y={16} s={9} />
        <Sparkle x={88} y={34} s={4.5} />
        <Sparkle x={70} y={4} s={3.5} />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      {...a11y}
    >
      <Head />
    </svg>
  );
}
