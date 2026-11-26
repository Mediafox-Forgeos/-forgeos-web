'use client';

import { ChevronLeft, ChevronRight, Maximize2, Play, X } from 'lucide-react';
import {
  Children,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
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
  expired = false,
}: {
  src: string;
  alt: string;
  className?: string;
  onFail?: () => void;
  /** URL que ya se sabe caducada: se muestra el aviso sin pedirla a la red. */
  expired?: boolean;
}) {
  const [failed, setFailed] = useState(expired);
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
  expired = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  expired?: boolean;
}) {
  const [failed, setFailed] = useState(expired);
  const fallback = !src || failed;
  return (
    <span className={cn('relative block h-full w-full', className)}>
      {src ? (
        <SafeImage
          src={src}
          alt={alt}
          expired={expired}
          onFail={() => setFailed(true)}
        />
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

/**
 * Visor ampliado de una imagen (diálogo nativo, accesible con teclado; Escape cierra).
 * Muestra la mejor resolución que entrega la fuente autorizada (`fullUrl`); no descarga ni
 * copia la imagen.
 */
export function MediaZoom({
  fullUrl,
  alt,
  children,
}: {
  fullUrl: string;
  alt: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="group relative block h-full w-full cursor-zoom-in"
        aria-label={`Ampliar: ${alt}`}
      >
        {children}
        <span
          aria-hidden
          className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Maximize2 className="h-3 w-3" /> Ampliar
        </span>
      </button>
      <dialog
        ref={ref}
        aria-label={alt}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto max-h-[92vh] max-w-[92vw] rounded-2xl bg-transparent p-0 backdrop:bg-black/80"
      >
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL externa de la red; sin optimizador de imágenes. */}
          <img
            src={fullUrl}
            alt={alt}
            referrerPolicy="no-referrer"
            className="max-h-[88vh] max-w-[90vw] rounded-2xl object-contain"
          />
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="bg-card text-foreground shadow-card absolute right-3 top-3 rounded-full p-2"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </dialog>
    </>
  );
}
