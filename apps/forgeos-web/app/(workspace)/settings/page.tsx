import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Settings"
        title="Workspace settings"
        description="Configuration will evolve as ForgeOS becomes operational."
      />
      <Card className="mt-10 grid min-h-52 place-items-center p-6 text-center">
        <p className="text-muted-foreground max-w-sm text-sm leading-6">
          Workspace configuration is intentionally quiet while the Foundation
          sprint establishes the operating model.
        </p>
      </Card>
    </div>
  );
}
