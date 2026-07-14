'use client';

import { ArrowUp, Bot, Command, Paperclip, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { workspaceMetrics } from '@/features/dashboard/data';

const suggestions = [
  'Organiza las prioridades de esta semana',
  'Resume el estado de mis proyectos',
  'Crea un plan para un nuevo cliente',
];

export function ArgosCommandCenter() {
  const [message, setMessage] = React.useState('');
  const [submittedMessage, setSubmittedMessage] = React.useState<string | null>(
    null,
  );

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt) return;
    setSubmittedMessage(prompt);
    setMessage('');
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:min-h-screen lg:px-12 lg:py-10">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Lunes, 13 de julio</p>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Todos los sistemas operativos
        </div>
      </div>

      <section
        id="argos"
        className="flex flex-1 flex-col justify-center py-14 sm:py-20"
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-7 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span className="grid size-7 place-items-center rounded-lg border border-border bg-card">
              <Bot className="size-4 text-foreground" />
            </span>
            ARGOS <span className="text-border">/</span> Tu copiloto operativo
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            Buenos días.
            <br />
            ¿Qué quieres lograr hoy?
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            ARGOS conecta el contexto de tus clientes, proyectos y equipo para
            convertir tus ideas en avance.
          </p>

          <form onSubmit={handleSubmit} className="mt-9">
            <div className="rounded-2xl border border-input bg-card p-2 shadow-2xl shadow-black/20 transition-colors focus-within:border-muted-foreground/50">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Pregunta a ARGOS o describe lo que necesitas..."
                rows={3}
                className="w-full resize-none bg-transparent px-3 pt-3 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
                aria-label="Mensaje para ARGOS"
              />
              <div className="flex items-center justify-between px-1 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                >
                  <Paperclip className="size-3.5" /> Adjuntar
                </Button>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                    <Command className="size-3" /> Enter para enviar
                  </span>
                  <Button
                    type="submit"
                    size="icon"
                    className="size-8 rounded-md"
                    aria-label="Enviar mensaje"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </form>

          {submittedMessage && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                Entendido. ARGOS está preparando un plan para:{' '}
                <span className="font-medium text-foreground">
                  {submittedMessage}
                </span>
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setMessage(suggestion)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-accent hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-label="Resumen del espacio de trabajo"
        className="grid grid-cols-2 gap-3 pb-2 lg:grid-cols-4"
      >
        {workspaceMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.label}
              className="p-4 transition-colors hover:bg-[#151519]"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {metric.label}
                </span>
                <Icon
                  className={cn('size-4 text-muted-foreground')}
                  aria-hidden="true"
                />
              </div>
              <p className="mt-5 text-2xl font-semibold tracking-tight">
                {metric.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {metric.detail}
              </p>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
