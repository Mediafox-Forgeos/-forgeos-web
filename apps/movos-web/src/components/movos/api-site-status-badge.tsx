import { Badge, type BadgeTone } from '@/components/ui/badge';

/**
 * Status badge for persisted API sites (SiteStatus enum from the MOVOS API).
 * Distinct from the demo SiteStatusBadge, which maps the legacy demo enum.
 */
const apiSiteStatusMap: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  ACTIVE: { label: 'Activo', tone: 'success' },
  INACTIVE: { label: 'Inactivo', tone: 'warning' },
  ARCHIVED: { label: 'Archivado', tone: 'muted' },
};

export function ApiSiteStatusBadge({ status }: { status: string }) {
  const descriptor = apiSiteStatusMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}
