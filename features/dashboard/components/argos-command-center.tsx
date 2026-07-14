'use client';

import { ArrowUp, Command, Paperclip, Sparkles } from 'lucide-react';
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
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:min-h-screen lg:px-12 lg:py-10">
      <section
        id="argos"
        className="flex flex-1 flex-col justify-center py-16 sm:py-24"
      >
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="mb-6 text-sm font-medium text-muted-foreground">
            ARGOS · Command Center
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            Buenos días, Álvaro.
          </h1>
          <p className="mt-3 text-balance text-xl tracking-[-0.02em] text-muted-foreground sm:text-2xl">
            ¿Qué quieres construir hoy?
          </p>

          <form onSubmit={handleSubmit} className="mt-10 text-left">
            <div className="rounded-2xl border border-input bg-card p-2 transition-colors focus-within:border-muted-foreground/60">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Pregunta a ARGOS o describe lo que necesitas..."
                rows={4}
                className="w-full resize-none bg-transparent px-4 pt-4 text-base leading-7 outline-none placeholder:text-muted-foreground"
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
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                Entendido. ARGOS está preparando un plan para:{' '}
                <span className="font-medium text-foreground">
                  {submittedMessage}
                </span>
              </p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
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
        id="workspace"
        aria-labelledby="recent-activity"
        className="pb-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="recent-activity" className="text-sm font-medium">
            Actividad reciente
          </h2>
          <span className="text-xs text-muted-foreground">Workspace</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {workspaceMetrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                className="p-4 transition-colors hover:bg-accent/50"
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
                <p className="mt-7 text-2xl font-medium tracking-tight">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {metric.detail}
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
