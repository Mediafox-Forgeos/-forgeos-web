'use client';

import { ArrowUp, Command, Paperclip } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';

export function ArgosComposer({
  quickActions,
}: {
  quickActions: readonly string[];
}) {
  const [message, setMessage] = React.useState('');
  const [submittedMessage, setSubmittedMessage] = React.useState<string | null>(
    null,
  );

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = message.trim();
    if (!prompt) return;
    setSubmittedMessage(prompt);
    setMessage('');
  }

  return (
    <div>
      <form onSubmit={onSubmit}>
        <div className="rounded-2xl border border-input bg-card p-2 transition-colors focus-within:border-muted-foreground/60">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask ARGOS to help you move the work forward..."
            rows={5}
            className="w-full resize-none bg-transparent px-4 pt-4 text-base leading-7 outline-none placeholder:text-muted-foreground"
            aria-label="Message ARGOS"
          />
          <div className="flex items-center justify-between px-1 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              <Paperclip className="size-3.5" /> Attach
            </Button>
            <div className="flex items-center gap-3">
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <Command className="size-3" /> Enter to send
              </span>
              <Button
                type="submit"
                size="icon"
                className="size-8 rounded-md"
                aria-label="Send message"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </form>
      {submittedMessage && (
        <p className="mt-3 rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          ARGOS is preparing the next step for:{' '}
          <span className="font-medium text-foreground">
            {submittedMessage}
          </span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setMessage(action)}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
