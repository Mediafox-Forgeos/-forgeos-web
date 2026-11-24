import {
  ExternalLink,
  Eye,
  Heart,
  ImageOff,
  MessageCircle,
  Play,
  Repeat2,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { PLATFORM_LABEL, SENTIMENT_LABEL, fmtRelative } from '@/lib/format';
import type { PostStats } from '@/lib/insights';
import type { Post, PostMediaItem, Sentiment } from '@/lib/types';
import { MediaCarousel, SafeImage } from './post-client';
import { NetworkIcon } from './network-icons';
import { Avatar, StatusPill, SyntheticBadge, type Tone } from './primitives';

/*
 * Publicaciones (decisión 8). Preparadas para fotos, videos y carruseles cuando la
 * fuente los entregue; hoy ninguna fuente los entrega y se muestra el fallback.
 * Nunca se inventan medios, avatares ni métricas.
 */

export const fmtNum = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('es-CO');

export const SENTIMENT_TONE: Record<Sentiment, Tone> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'critical',
  mixed: 'ai',
};

export function mediaAlt(post: Post, m: PostMediaItem, i: number, n: number) {
  if (m.alt) return m.alt;
  const kind = m.kind === 'video' ? 'Video' : 'Imagen';
  return `${kind}${n > 1 ? ` ${i + 1} de ${n}` : ''} de la publicación de ${PLATFORM_LABEL[post.platform]}${post.accountHandle ? ` de ${post.accountHandle}` : ''}`;
}

/** Un medio: imagen o video (sin reproducción automática). */
export function MediaItem({
  post,
  item,
  index = 0,
  count = 1,
  className,
}: {
  post: Post;
  item: PostMediaItem;
  index?: number;
  count?: number;
  className?: string;
}) {
  const alt = mediaAlt(post, item, index, count);
  // Video del que la fuente solo entrega miniatura: miniatura + duración, sin reproductor.
  if (item.kind === 'video' && item.playable === false)
    return (
      <span className={cn('relative block h-full w-full', className)}>
        {item.previewUrl ? (
          <SafeImage src={item.previewUrl} alt={alt} />
        ) : (
          <span className="bg-muted block h-full w-full" />
        )}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="h-6 w-6" />
          </span>
        </span>
      </span>
    );
  if (item.kind === 'video')
    return (
      <video
        controls
        preload="none"
        playsInline
        poster={item.previewUrl ?? undefined}
        aria-label={alt}
        className={cn('h-full w-full bg-black object-contain', className)}
      >
        <source src={item.url} />
      </video>
    );
  return (
    <SafeImage
      src={item.previewUrl ?? item.url}
      alt={alt}
      className={className}
    />
  );
}

/** Área de medios de una publicación: carrusel, medio único o fallback honesto. */
export function PostMedia({
  post,
  variant = 'card',
}: {
  post: Post;
  variant?: 'card' | 'detail';
}) {
  const media = post.media ?? [];
  const box = cn(
    'relative overflow-hidden bg-muted',
    variant === 'card'
      ? 'aspect-[4/3] rounded-t-card'
      : 'aspect-square rounded-card sm:aspect-[4/5]',
  );
  if (media.length > 1)
    return (
      <div className={box}>
        <MediaCarousel
          count={media.length}
          label={`Carrusel de ${media.length} medios`}
        >
          {media.map((m, i) => (
            <MediaItem
              key={m.url}
              post={post}
              item={m}
              index={i}
              count={media.length}
            />
          ))}
        </MediaCarousel>
      </div>
    );
  if (media.length === 1)
    return (
      <div className={box}>
        <MediaItem post={post} item={media[0]!} />
        {media[0]!.kind === 'video' && media[0]!.durationSec && (
          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-bold text-white">
            {Math.floor(media[0]!.durationSec / 60)}:
            {String(Math.round(media[0]!.durationSec % 60)).padStart(2, '0')}
          </span>
        )}
      </div>
    );
  // Sin medios: franja compacta (no un bloque vacío del tamaño de una foto).
  return (
    <div
      className={cn(
        'from-mod-explorer to-primary-pale/50 flex items-center gap-3 bg-gradient-to-br px-4',
        variant === 'card' ? 'rounded-t-card h-[76px]' : 'rounded-card h-24',
      )}
    >
      <span className="bg-card shadow-card flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
        <NetworkIcon platform={post.platform} size={24} />
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold">
          <ImageOff aria-hidden className="text-muted-foreground h-3.5 w-3.5" />
          Sin vista previa
        </p>
        <p className="text-muted-foreground text-xs leading-snug">
          La fuente no entregó fotos ni videos.
        </p>
      </div>
    </div>
  );
}

/** Autor o cuenta: avatar real solo si la fuente lo entrega; si no, iniciales. */
export function AuthorChip({ post, size = 36 }: { post: Post; size?: number }) {
  const name =
    post.author?.displayName ?? post.accountHandle ?? 'Cuenta no disponible';
  const handle = post.author?.handle ?? post.accountHandle;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="relative flex h-fit shrink-0 self-start">
        {post.author?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar externo entregado por la fuente.
          <img
            src={post.author.avatarUrl}
            alt=""
            width={size}
            height={size}
            referrerPolicy="no-referrer"
            className="rounded-full object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <Avatar name={name} size={size} />
        )}
        <span className="bg-card absolute -bottom-0.5 -right-0.5 rounded-full p-0.5">
          <NetworkIcon platform={post.platform} size={12} />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold">{name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {PLATFORM_LABEL[post.platform]}
          {handle && handle !== name ? ` · ${handle}` : ''}
          {post.publishedAt && (
            <>
              {' · '}
              <time dateTime={post.publishedAt}>
                {fmtRelative(post.publishedAt)}
              </time>
            </>
          )}
        </span>
      </span>
    </div>
  );
}

/** Métricas con icono; «—» cuando la fuente no entrega la métrica (nunca 0 inventado). */
export function PostMetricsRow({
  stats,
  className,
  size = 'sm',
}: {
  stats: PostStats;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const m = stats.latest;
  const items = [
    { icon: Heart, label: 'Me gusta', v: m?.likes },
    { icon: MessageCircle, label: 'Comentarios', v: m?.comments },
    { icon: Repeat2, label: 'Compartidos', v: m?.shares },
    { icon: Eye, label: 'Vistas', v: m?.views },
    { icon: Users, label: 'Alcance', v: m?.reach },
  ];
  return (
    <dl
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 tabular-nums',
        size === 'md' ? 'text-sm' : 'text-xs',
        className,
      )}
    >
      {items.map(({ icon: Icon, label, v }) => (
        <div key={label} className="flex items-center gap-1" title={label}>
          <dt>
            <Icon
              aria-hidden
              className={size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5'}
            />
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="text-foreground font-bold">{fmtNum(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OriginalLink({
  post,
  className,
}: {
  post: Post;
  className?: string;
}) {
  if (!post.permalink) return null;
  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-primary-text inline-flex items-center gap-1 text-xs font-bold underline underline-offset-2',
        className,
      )}
    >
      Ver en {PLATFORM_LABEL[post.platform]}
      <ExternalLink aria-hidden className="h-3.5 w-3.5" />
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </a>
  );
}

export function SentimentPill({ s, label }: { s: Sentiment; label?: string }) {
  return (
    <StatusPill tone={SENTIMENT_TONE[s]}>
      {label ?? SENTIMENT_LABEL[s]}
    </StatusPill>
  );
}

/** Tarjeta de galería de Social Explorer. */
export function SocialPostCard({
  post,
  stats,
  comments,
  dominant,
  href,
}: {
  post: Post;
  stats: PostStats;
  comments: number;
  dominant: Sentiment | null;
  href: string;
}) {
  return (
    <article className="rounded-card border-border/80 bg-card shadow-card hover:shadow-lift duration-base group relative flex h-full flex-col border transition-shadow">
      <PostMedia post={post} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <AuthorChip post={post} size={32} />
        <h3 className="line-clamp-3 text-sm font-semibold leading-snug">
          <Link
            href={href}
            className="after:absolute after:inset-0 focus-visible:underline group-hover:underline"
          >
            {post.body ?? 'Publicación sin texto'}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {post.isSynthetic && <SyntheticBadge />}
          {dominant && (
            <SentimentPill
              s={dominant}
              label={`Comentarios: ${SENTIMENT_LABEL[dominant].toLowerCase()}`}
            />
          )}
          {stats.unusual && (
            <StatusPill tone="high" icon={TrendingUp}>
              Actividad inusual
            </StatusPill>
          )}
        </div>
        <div className="border-border mt-auto border-t pt-3">
          <PostMetricsRow stats={stats} />
        </div>
        <p className="text-muted-foreground -mt-1 text-xs">
          <span className="text-foreground font-bold tabular-nums">
            {fmtNum(stats.interactions)}
          </span>{' '}
          interacciones ·{' '}
          <span className="text-foreground font-bold">{comments}</span>{' '}
          {comments === 1 ? 'comentario analizado' : 'comentarios analizados'}
        </p>
      </div>
    </article>
  );
}
