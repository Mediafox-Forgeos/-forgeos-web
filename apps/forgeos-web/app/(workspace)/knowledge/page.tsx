import { BookOpen } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { knowledgeCategories } from '@/data/knowledge';

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <PageHeader
        eyebrow="Knowledge"
        title="The Forge knowledge base"
        description="A deliberate home for the context that makes ARGOS and the team more capable."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {knowledgeCategories.map((category) => (
          <Card key={category.name} className="flex min-h-48 flex-col p-5">
            <BookOpen className="text-muted-foreground size-4" />
            <h2 className="mt-auto text-lg font-medium">{category.name}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              {category.description}
            </p>
            <p className="text-muted-foreground mt-5 text-xs">No entries yet</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
