import { ClientCard } from '@/components/forgeos/client-card';
import { PageHeader } from '@/components/layout/page-header';
import { kylumEnergy } from '@/data/clients';

export default function ClientsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Clients"
        title="Pilot relationships"
        description="Customers validate product direction; they do not define the product."
      />
      <div className="mt-10 max-w-3xl">
        <ClientCard client={kylumEnergy} />
      </div>
    </div>
  );
}
