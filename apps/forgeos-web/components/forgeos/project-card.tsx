import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { StatusBadge } from '@/components/forgeos/status-badge';
import { Card } from '@/components/ui/card';
import type { Project } from '@/types';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card className="hover:bg-accent/50 p-5 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium">Project</p>
            <h2 className="mt-2 text-xl font-medium tracking-tight">
              {project.name}
            </h2>
          </div>
          <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <StatusBadge status={project.status} />
          <StatusBadge status={project.priority} />
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          Pilot · {project.pilot}
        </p>
      </Card>
    </Link>
  );
}
