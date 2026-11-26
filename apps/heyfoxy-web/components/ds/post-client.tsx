'use client';

import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Children, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Carrusel accesible: botones, flechas del teclado y contador «n de N». */
export function MediaCarousel({
  children,
  count,
  label,
}: {
  children: ReactNode;
  count: number;
  label: string;
}) {
  const [i, setI] = useState(0);
  const slides = Children.toArray(children);
  const go = (d: number) => setI((v) => (v + d + count) % count);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };
  const nav =
    'absolute top-1/2 -translate-y-1/2 rounded-full bg-card/90 p-1.5 text-foreground shadow-card hover:bg-card';
  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKey}
      className="relative h-full w-full"
    >
      {slides.map((s, k) => (
        <div
          key={k}
          role="group"
          aria-roledescription="diapositiva"
          aria-label={`${k + 1} de ${count}`}
          hidden={k !== i}
          className="h-full w-full"
        >
          {s}
        </div>
      ))}
      <button
        type="button"
        onClick={() => go(-1)}
        className={cn(nav, 'left-2')}
        aria-label="Medio anterior"
      >
        <ChevronLeft aria-hidden className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        className={cn(nav, 'right-2')}
        aria-label="Medio siguiente"
      >
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white"
      >
        {i + 1}/{count}
      </span>
    </div>
  );
}

/**
 * Imagen externa con caída honesta: si la URL caducó o fue retirada por la red, se muestra
 * «Vista previa caducada» en lugar de un hueco o de una imagen inventada (fase D).
 */
export function SafeImage({
  src,
  alt,
  className,
  onFail,
}: {
  src: string;
  alt: string;
  className?: string;
  onFail?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        role="img"
        aria-label={`${alt} (vista previa caducada)`}
        className={cn(
          'bg-muted text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-xs font-bold',
          className,
        )}
      >
        Vista previa caducada
        <span className="font-semibold">Ábrela en la red original</span>
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URL externa de la red; sin optimizador de imágenes.
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        setFailed(true);
        onFail?.();
      }}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}

/**
 * Video del que la fuente solo entrega la miniatura (Metricool): miniatura con el botón de
 * reproducción centrado. Si no hay miniatura o caducó, el texto de caída ocupa el centro y el
 * indicador de video pasa a una esquina para no taparlo (HF-UX-07).
 */
export function VideoThumbnail({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = !src || failed;
  return (
    <span className={cn('relative block h-full w-full', className)}>
      {src ? (
        <SafeImage src={src} alt={alt} onFail={() => setFailed(true)} />
      ) : (
        <span
          role="img"
          aria-label={`${alt} (sin miniatura)`}
          className="bg-muted text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-xs font-bold"
        >
          Video sin miniatura
          <span className="font-semibold">Ábrelo en la red original</span>
        </span>
      )}
      {fallback ? (
        <span
          aria-hidden
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white"
        >
          <Play className="h-3 w-3" />
          Video
        </span>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="h-6 w-6" />
          </span>
        </span>
      )}
    </span>
  );
}
