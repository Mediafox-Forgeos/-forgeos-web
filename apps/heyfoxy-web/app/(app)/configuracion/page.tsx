import { Badge, Card, PageHeader, buttonCls } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { getUiTheme } from '@/lib/shell';
import { UI_THEMES, UI_THEME_LABEL } from '@/lib/ui-theme';
import { setUiTheme } from '../theme-actions';

export const metadata = { title: 'Configuración' };

const ROLE_DESC: Record<string, string> = {
  owner: 'Control total, incluida la gestión de owners',
  admin: 'Configura fuentes, reglas, miembros y WhatsApp',
  analyst: 'Revisa alertas y gestiona incidentes',
  responder: 'Gestiona incidentes asignados',
  viewer: 'Solo lectura',
};

export default async function SettingsPage() {
  const { active, repo } = await requireContext();
  const members = await repo.members(active.organization.id);
  const theme = await getUiTheme();
  return (
    <>
      <PageHeader
        layer="platform"
        title="Configuración"
        description="Organización, miembros y políticas de datos."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium">Organización</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Nombre</dt>
              <dd>{active.organization.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Retención de datos</dt>
              <dd>{active.organization.retentionDays} días</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>
                {active.organization.isDemo ? (
                  <Badge t="amber">Demostración</Badge>
                ) : (
                  'Cliente'
                )}
              </dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-medium">Miembros</h2>
          <ul className="mt-3 divide-y text-sm">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-2 py-2"
              >
                <span className="min-w-0 truncate">{m.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    {ROLE_DESC[m.role]}
                  </span>
                  <Badge>{m.role}</Badge>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs">
            Acceso solo por invitación. Los permisos se aplican en la base de
            datos (RLS), no solo en la interfaz.
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium">Apariencia</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Interfaz V2 en claro u oscuro, o la interfaz clásica (V1) mientras
            dura la transición. Solo cambia la presentación.
          </p>
          <form action={setUiTheme} className="mt-3 flex flex-wrap gap-2">
            {UI_THEMES.map((t) => (
              <button
                key={t}
                name="theme"
                value={t}
                aria-pressed={theme === t}
                className={t === theme ? buttonCls.primary : buttonCls.ghost}
              >
                {UI_THEME_LABEL[t]}
              </button>
            ))}
          </form>
        </Card>
      </div>
    </>
  );
}
