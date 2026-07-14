import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { StatusBadge } from '@/components/forgeos/status-badge';
import { Card } from '@/components/ui/card';
import type { Project } from '@/types';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="p-5 transition-colors hover:bg-accent/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Project</p>
            <h2 className="mt-2 text-xl font-medium tracking-tight">
              {project.name}
            </h2>
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <StatusBadge status={project.status} />
          <StatusBadge status={project.priority} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Pilot · {project.pilot}
        </p>
      </Card>
    </Link>
  );
}
