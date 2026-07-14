import { FlaskConical } from 'lucide-react';

import { cn } from '@/lib/utils';

export function DemoNotice({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'border-movos-blue/40 bg-movos-blue/10 text-movos-blue inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium',
        className,
      )}
    >
      <FlaskConical className="size-3" aria-hidden="true" />
      Datos de demostración
    </span>
  );
}
