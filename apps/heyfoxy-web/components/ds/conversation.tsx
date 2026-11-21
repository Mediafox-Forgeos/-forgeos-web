import { CircleAlert } from 'lucide-react';
import {
  INTENT_LABEL,
  PLATFORM_LABEL,
  SEVERITY_LABEL,
  fmtRelative,
} from '@/lib/format';
import type { ConversationItem, Severity } from '@/lib/types';
import { NetworkIcon } from './network-icons';
import { SentimentPill } from './post';
import { Avatar, StatusPill, SyntheticBadge, type Tone } from './primitives';

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: 'critical',
  high: 'high',
  attention: 'warning',
  info: 'neutral',
};

/**
 * Fila de conversación (comentario o mención). Sin fotos de perfil: el autor de
 * comentarios se minimiza (author_hash), solo se muestran iniciales del alias.
 */
export function ConversationRow({ i }: { i: ConversationItem }) {
  const a = i.analysis;
  return (
    <article className="flex gap-3 py-3">
      <span className="relative flex h-fit shrink-0 self-start">
        <Avatar
          name={i.authorDisplay ?? PLATFORM_LABEL[i.platform]}
          size={36}
        />
        <span className="bg-card absolute -bottom-0.5 -right-0.5 rounded-full p-0.5">
          <NetworkIcon platform={i.platform} size={12} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="text-foreground font-extrabold">
            {i.authorDisplay ?? 'Autor no disponible'}
          </span>
          <span aria-hidden>·</span>
          <span>{PLATFORM_LABEL[i.platform]}</span>
          <span aria-hidden>·</span>
          <time dateTime={i.publishedAt}>{fmtRelative(i.publishedAt)}</time>
        </p>
        <p className="mt-1 text-sm leading-snug">{i.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {i.isSynthetic && <SyntheticBadge />}
          {a ? (
            <>
              <SentimentPill s={a.sentiment} />
              {a.severity !== 'info' && (
                <StatusPill tone={SEVERITY_TONE[a.severity]} icon={CircleAlert}>
                  {SEVERITY_LABEL[a.severity]}
                </StatusPill>
              )}
              <StatusPill tone="neutral">{INTENT_LABEL[a.intent]}</StatusPill>
              {a.topics.slice(0, 2).map((t) => (
                <StatusPill key={t} tone="neutral">
                  #{t}
                </StatusPill>
              ))}
            </>
          ) : (
            <StatusPill tone="neutral">Sin analizar</StatusPill>
          )}
        </div>
      </div>
    </article>
  );
}
