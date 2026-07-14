import { ProjectCard } from '@/components/forgeos/project-card';
import { PageHeader } from '@/components/layout/page-header';
import { evPlatform } from '@/data/projects';

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Projects"
        title="Product workspaces"
        description="Products are the operational center of the Forge."
      />
      <div className="mt-10 max-w-xl">
        <ProjectCard project={evPlatform} />
      </div>
    </div>
  );
}
