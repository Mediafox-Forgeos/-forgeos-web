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
        <div className="border-input bg-card focus-within:border-muted-foreground/60 rounded-2xl border p-2 transition-colors">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask ARGOS to help you move the work forward..."
            rows={5}
            className="placeholder:text-muted-foreground w-full resize-none bg-transparent px-4 pt-4 text-base leading-7 outline-none"
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
              <span className="text-muted-foreground hidden items-center gap-1 text-xs sm:flex">
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
        <p className="border-border text-muted-foreground mt-3 rounded-lg border px-4 py-3 text-sm">
          ARGOS is preparing the next step for:{' '}
          <span className="text-foreground font-medium">
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
            className="border-border text-muted-foreground hover:bg-accent hover:text-foreground rounded-full border px-3 py-1.5 text-xs transition-colors"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
