import {
  Activity,
  BellRing,
  ChartNoAxesCombined,
  ClipboardCheck,
  House,
  Images,
  MessageSquareText,
  MessagesSquare,
  Radar,
  Settings,
  ShieldAlert,
  Sparkles,
  Brain,
  Tags,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Muestra el contador de alertas pendientes. */
  badge?: 'alerts';
}
export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/** Navegación V2 (decisión 2, opción A): «Inicio» integra el antiguo «Resumen». */
export const NAV: NavGroup[] = [
  { label: null, items: [{ href: '/', label: 'Inicio', icon: House }] },
  {
    label: 'Foxy',
    items: [
      { href: '/foxy', label: 'Ask Foxy', icon: Sparkles },
      { href: '/brand-brain', label: 'Foxy Brand Brain', icon: Brain },
    ],
  },
  {
    label: 'Inteligencia reputacional',
    items: [
      { href: '/alertas', label: 'Alertas', icon: BellRing, badge: 'alerts' },
      { href: '/revision', label: 'Revisión humana', icon: ClipboardCheck },
      { href: '/incidentes', label: 'Incidentes', icon: ShieldAlert },
      { href: '/temas', label: 'Temas', icon: Tags },
      { href: '/publicaciones', label: 'Social Explorer', icon: Images },
      { href: '/reportes', label: 'Reportes', icon: ChartNoAxesCombined },
    ],
  },
  {
    label: 'Escucha operativa',
    items: [
      {
        href: '/conversaciones',
        label: 'Conversaciones',
        icon: MessagesSquare,
      },
      { href: '/cobertura', label: 'Fuentes y cobertura', icon: Radar },
    ],
  },
  {
    label: 'Plataforma',
    items: [
      { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquareText },
      { href: '/uso', label: 'Uso y presupuestos', icon: Activity },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];

export const isActive = (href: string, path: string) =>
  href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
