import Link from 'next/link';
import type { ReactNode } from 'react';

export type Breadcrumb = { label: string; href?: string };

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <header className="border-border flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Ruta de navegación"
            className="text-muted-foreground mb-3 flex items-center gap-2 text-xs"
          >
            {breadcrumbs.map((crumb, index) => (
              <span
                key={`${crumb.label}-${index}`}
                className="flex items-center gap-2"
              >
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && <span>/</span>}
              </span>
            ))}
          </nav>
        )}
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
      {actions}
    </header>
  );
}
