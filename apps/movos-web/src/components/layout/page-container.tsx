import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10',
        className,
      )}
    >
      {children}
    </div>
  );
}
