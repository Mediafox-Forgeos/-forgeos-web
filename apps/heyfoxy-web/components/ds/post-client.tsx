'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
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
