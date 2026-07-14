import Link from 'next/link';
import { MapPin, Plug, ServerCog, TriangleAlert } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { SiteStatusBadge } from '@/components/movos/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { sites } from '@/data/sites';

export default function SitesPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Sitios"
        description="Ubicaciones físicas de la red de carga y su estado operativo."
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {sites.map((site) => (
          <Link key={site.id} href={`/sites/${site.id}`}>
            <Card className="hover:border-movos-blue/50 h-full transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{site.name}</CardTitle>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <MapPin className="size-3" aria-hidden="true" />
                      {site.city} · {site.address}
                    </p>
                  </div>
                  <SiteStatusBadge status={site.status} />
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat
                  icon={<ServerCog className="size-3.5" />}
                  label="Estaciones"
                  value={site.stationCount}
                />
                <Stat
                  icon={<Plug className="size-3.5" />}
                  label="Cargadores"
                  value={site.chargerCount}
                />
                <Stat
                  icon={<Plug className="size-3.5" />}
                  label="Conectores libres"
                  value={`${site.availableConnectors}/${site.totalConnectors}`}
                />
                <Stat
                  icon={<TriangleAlert className="size-3.5" />}
                  label="Alertas"
                  value={site.openAlerts}
                />
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </PageContainer>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
