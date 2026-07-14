import { Check } from 'lucide-react';

import { Card } from '@/components/ui/card';
import type { Sprint } from '@/types';

export function SprintProgress({ sprint }: { sprint: Sprint }) {
  const completedTasks = sprint.tasks.filter((task) => task.completed).length;
  const progress = (completedTasks / sprint.tasks.length) * 100;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Current Sprint
          </p>
          <h2 className="mt-1 text-lg font-medium tracking-tight">
            {sprint.name}
          </h2>
        </div>
        <span className="text-sm font-medium">
          {completedTasks}/{sprint.tasks.length}
        </span>
      </div>
      <div
        className="mt-5 h-1.5 overflow-hidden rounded-full bg-accent"
        aria-label={`${completedTasks} of ${sprint.tasks.length} tasks complete`}
      >
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ul className="mt-6 space-y-3">
        {sprint.tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 text-sm">
            <span className="grid size-4 place-items-center rounded border border-border text-muted-foreground">
              {task.completed && (
                <Check
                  className="size-3 text-foreground"
                  aria-label="Completed"
                />
              )}
            </span>
            <span
              className={
                task.completed
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground'
              }
            >
              {task.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
