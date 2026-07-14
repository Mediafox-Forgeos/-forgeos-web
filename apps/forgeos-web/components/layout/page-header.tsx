import type { ReactNode } from 'react';

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="border-border flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-[0.16em]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
