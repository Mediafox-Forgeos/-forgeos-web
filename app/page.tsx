import { AppSidebar } from '@/components/layout/app-sidebar';
import { ArgosCommandCenter } from '@/features/dashboard/components/argos-command-center';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background lg:flex">
      <AppSidebar />
      <main className="min-w-0 flex-1">
        <ArgosCommandCenter />
      </main>
    </div>
  );
}
