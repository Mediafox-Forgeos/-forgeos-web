import { Download } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { reportCards } from '@/data/reports';

export default function ReportsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        description="Informes operativos y comerciales de la red. Generación próximamente."
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((report) => (
          <Card key={report.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{report.title}</CardTitle>
                {!report.available && <Badge tone="muted">Próximamente</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                {report.description}
              </p>
              <Button variant="outline" size="sm" disabled className="w-fit">
                <Download className="size-4" />
                Descargar
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </PageContainer>
  );
}
