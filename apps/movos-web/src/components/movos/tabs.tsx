'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

export function Tabs({
  items,
  defaultTab,
}: {
  items: TabItem[];
  defaultTab?: string;
}) {
  const [active, setActive] = React.useState(defaultTab ?? items[0]?.id);
  const current = items.find((item) => item.id === active) ?? items[0];

  return (
    <div>
      <nav
        className="border-border text-muted-foreground flex gap-4 overflow-x-auto border-b text-sm"
        aria-label="Secciones"
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActive(item.id)}
            className={cn(
              'hover:text-foreground shrink-0 border-b-2 border-transparent py-3 transition-colors',
              item.id === current?.id && 'border-movos-blue text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-6">{current?.content}</div>
    </div>
  );
}
