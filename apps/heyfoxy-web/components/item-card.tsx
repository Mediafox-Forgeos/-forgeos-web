import {
  Badge,
  Card,
  SentimentBadge,
  SeverityBadge,
  SyntheticTag,
} from '@/components/ui';
import { INTENT_LABEL, PLATFORM_LABEL, fmtRelative } from '@/lib/format';
import type { ConversationItem } from '@/lib/types';

/** Tarjeta de una conversación clasificada (Conversaciones y detalle de publicación). */
export function ItemCard({ i }: { i: ConversationItem }) {
  return (
    <Card className="p-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span className="text-foreground font-medium">
          {PLATFORM_LABEL[i.platform]}
        </span>
        <span>·</span>
        <span>{i.authorDisplay ?? 'autor no disponible'}</span>
        <span>·</span>
        <time dateTime={i.publishedAt}>{fmtRelative(i.publishedAt)}</time>
        {i.isSynthetic && <SyntheticTag />}
      </div>
      <p className="mt-1.5 text-sm">{i.body}</p>
      {i.analysis ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <SentimentBadge s={i.analysis.sentiment} />
          <SeverityBadge s={i.analysis.severity} />
          <Badge>{INTENT_LABEL[i.analysis.intent]}</Badge>
          <Badge t={i.analysis.layer === 'reputational' ? 'violet' : 'blue'}>
            {i.analysis.layer === 'reputational' ? 'Reputacional' : 'Operativa'}
          </Badge>
          {i.analysis.topics.map((t) => (
            <Badge key={t}>#{t}</Badge>
          ))}
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            Prioridad {Math.round(i.analysis.priorityScore)} · confianza{' '}
            {Math.round(i.analysis.confidence * 100)}%
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">
          Sin analizar (presupuesto o cola).
        </p>
      )}
      {i.analysis && (
        <p className="text-muted-foreground mt-1.5 text-xs">
          IA: {i.analysis.explanation}
        </p>
      )}
    </Card>
  );
}
