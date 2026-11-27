'use client';

import { ArrowUpRight, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { FoxyMark } from './foxy';
import { EngineBadge, type EngineBadgeState } from './ai-engine';
import {
  AskBox,
  FoxyThread,
  useFoxyConversation,
  type Turn,
} from './intel-client';

/*
 * Copiloto contextual de Foxy (DS v0.4 · ContextualCopilotPanel). Panel lateral desplegable
 * disponible en todas las pantallas V2 sin abandonarlas. Conserva el contexto activo que
 * declara cada pantalla (organización, marca, publicación, red, periodo, filtros) y la
 * conversación por contexto mientras dure la sesión de navegación. En móvil, pantalla completa.
 * Cada respuesta declara su motor: IA generativa (modelo), simulación o motor local.
 */

export interface CopilotContextValue {
  /** Pantalla desde la que se consulta (p. ej. «Detalle de publicación»). */
  screen: string;
  /** Publicación activa, si la hay. */
  postId: string | null;
  platform: string | null;
  /** Etiqueta legible del contexto (marca · red · formato · periodo · filtros). */
  label: string;
  suggestions: readonly string[];
  /** Patrón del enlace a publicaciones citadas («{id}»). */
  postHrefPattern: string;
}

interface CopilotState {
  open: boolean;
  setOpen: (v: boolean) => void;
  scope: CopilotContextValue | null;
  setScope: (s: CopilotContextValue | null) => void;
  /** Pregunta en cola para enviar al abrir (preguntas sugeridas fuera del panel). */
  queued: string | null;
  setQueued: (q: string | null) => void;
}

const Ctx = createContext<CopilotState | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CopilotContextValue | null>(null);
  const [queued, setQueued] = useState<string | null>(null);
  const value = useMemo(
    () => ({ open, setOpen, scope, setScope, queued, setQueued }),
    [open, scope, queued],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const useCopilot = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('CopilotProvider ausente');
  return c;
};

/** Declara el contexto de la pantalla para el copiloto (no renderiza nada). */
export function CopilotScope(props: CopilotContextValue) {
  const { setScope } = useCopilot();
  const key = JSON.stringify(props);
  useEffect(() => {
    setScope(JSON.parse(key) as CopilotContextValue);
    return () => setScope(null);
  }, [key, setScope]);
  return null;
}

/** Botón de la barra superior que abre el copiloto. */
export function CopilotTrigger() {
  const { open, setOpen } = useCopilot();
  return (
    <button
      type="button"
      id="copilot-trigger"
      aria-expanded={open}
      aria-controls="foxy-copilot"
      onClick={() => setOpen(!open)}
      className="bg-primary-pale text-primary-text hover:bg-primary-pale/70 flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-extrabold"
    >
      <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.9} />
      <span className="hidden lg:inline">Foxy IA</span>
      <span className="sr-only lg:hidden">Foxy IA</span>
    </button>
  );
}

/** Abre el copiloto con una pregunta (p. ej. desde las preguntas sugeridas de Home). */
export function CopilotAskButton({
  question,
  className,
  children,
}: {
  question: string;
  className?: string;
  children?: ReactNode;
}) {
  const { setOpen, setQueued } = useCopilot();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        setQueued(question);
        setOpen(true);
      }}
    >
      {children ?? question}
    </button>
  );
}

const BRAND_FALLBACK = [
  '¿Qué contenidos están funcionando mejor?',
  '¿Qué formatos deberíamos priorizar?',
  '¿Qué oportunidades creativas tenemos?',
  '¿Qué deberíamos publicar la próxima semana?',
  '¿Estamos cumpliendo nuestra estrategia?',
];

function Conversation({
  scope,
  period,
  initial,
  onTurns,
}: {
  scope: CopilotContextValue;
  period: string;
  initial: Turn[];
  onTurns: (t: Turn[]) => void;
}) {
  const { turns, ask, pending, cancel } = useFoxyConversation(
    {
      postId: scope.postId,
      platform: scope.platform,
      period,
      scopeLabel: `${scope.screen} · ${scope.label}`,
    },
    initial,
  );
  useEffect(() => onTurns(turns), [turns, onTurns]);
  const { queued, setQueued } = useCopilot();
  useEffect(() => {
    if (!queued || pending) return;
    setQueued(null);
    ask(queued);
  }, [queued, pending, ask, setQueued]);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
    // Sigue la respuesta mientras llega (streaming) y al añadir turnos.
  }, [turns]);
  const postHref = (id: string) =>
    scope.postHrefPattern.replace('{id}', encodeURIComponent(id));
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {turns.length === 0 && (
          <div>
            <p className="text-muted-foreground text-[13px]">
              Pregunta sin salir de esta pantalla. Foxy responde con evidencia
              de los datos autorizados y dice cuándo no puede responder.
            </p>
            <p className="text-muted-foreground mt-4 text-[11px] font-extrabold uppercase tracking-wider">
              Preguntas sugeridas
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {scope.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => ask(s)}
                  className="bg-card hover:border-ai-fg/40 border-border rounded-xl border px-3 py-2 text-left text-[13px] font-bold disabled:opacity-60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <FoxyThread
          turns={turns}
          postHref={postHref}
          onAsk={ask}
          pending={pending}
        />
        <div ref={endRef} />
      </div>
      <div className="border-border bg-card border-t p-3">
        <AskBox
          id="copilot-ask"
          onAsk={ask}
          pending={pending}
          onCancel={cancel}
          autoFocus
        />
      </div>
    </>
  );
}

export function ContextualCopilotPanel({
  orgName,
  engine = {
    state: 'local',
    label: 'Motor local por reglas · sin IA generativa',
  },
}: {
  orgName: string;
  /** Motor disponible según el servidor; cada respuesta declara el que la produjo. */
  engine?: { state: EngineBadgeState; label: string };
}) {
  const { open, setOpen, scope } = useCopilot();
  const sp = useSearchParams();
  const period = sp.get('periodo') ?? '30d';
  const effective: CopilotContextValue = scope ?? {
    screen: 'Marca',
    postId: null,
    platform: null,
    label: `${orgName} · todas las redes`,
    suggestions: BRAND_FALLBACK,
    postHrefPattern: `/publicaciones/{id}?periodo=${period}`,
  };
  // Conversación conservada por contexto mientras dure la navegación.
  const store = useRef(new Map<string, Turn[]>());
  const key = `${effective.postId ?? 'marca'}|${effective.platform ?? ''}|${period}`;
  const onTurns = useCallback(
    (t: Turn[]) => {
      store.current.set(key, t);
    },
    [key],
  );
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        document.getElementById('copilot-trigger')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  // Cerrado no renderiza contenido: el contexto lo declaran las pantallas tras hidratarse y
  // el panel (en su propio Suspense) no debe producir un texto distinto al del servidor.
  if (!open)
    return <aside id="foxy-copilot" aria-label="Pregúntale a Foxy" hidden />;
  return (
    <aside
      id="foxy-copilot"
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby="copilot-title"
      hidden={!open}
      className={cn(
        'bg-background border-border shadow-lift fixed inset-0 z-50 flex-col sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:border-l',
        open ? 'flex' : 'hidden',
      )}
    >
      <header className="border-border flex items-start gap-3 border-b bg-gradient-to-br from-[hsl(var(--ai-bg))] to-[hsl(var(--card))] px-4 py-3">
        <FoxyMark size={36} />
        <div className="min-w-0 flex-1">
          <h2 id="copilot-title" className="text-base font-extrabold">
            Pregúntale a Foxy
          </h2>
          <p
            className="text-muted-foreground truncate text-xs"
            title={effective.label}
          >
            {effective.screen} · {effective.label}
          </p>
          <div className="mt-1">
            <EngineBadge state={engine.state} label={engine.label} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            document.getElementById('copilot-trigger')?.focus();
          }}
          className="hover:bg-muted rounded-xl p-2"
          aria-label="Cerrar Foxy"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <Conversation
          key={key}
          scope={effective}
          period={period}
          initial={store.current.get(key) ?? []}
          onTurns={onTurns}
        />
      )}
      <Link
        href={`/foxy?periodo=${period}`}
        onClick={() => setOpen(false)}
        className="text-primary-text border-border bg-card flex items-center justify-center gap-1 border-t px-4 py-2 text-xs font-extrabold"
      >
        Abrir Ask Foxy (consultas generales){' '}
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
      </Link>
    </aside>
  );
}
