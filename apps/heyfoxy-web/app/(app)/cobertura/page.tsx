import { Badge, Card, CoverageBadge, PageHeader } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { PROVIDER_CATALOG } from '@/lib/connectors/registry';
import { PLATFORM_LABEL, fmtDateTime } from '@/lib/format';
import type { SourceStatus } from '@/lib/types';

export const metadata = { title: 'Fuentes y cobertura' };

const STATUS: Record<
  SourceStatus,
  { label: string; t: 'green' | 'amber' | 'red' | 'neutral' }
> = {
  connected: { label: 'Conectada', t: 'green' },
  pending_authorization: { label: 'Pendiente de autorización', t: 'amber' },
  insufficient_permissions: { label: 'Sin permisos suficientes', t: 'red' },
  not_connected: { label: 'No conectada', t: 'neutral' },
  error: { label: 'Error', t: 'red' },
  disabled: { label: 'Deshabilitada', t: 'neutral' },
};
const KIND: Record<string, string> = {
  comments: 'Comentarios',
  mentions: 'Menciones',
  posts: 'Publicaciones',
  post_metrics: 'Métricas',
  direct_messages: 'Mensajes',
  reviews: 'Reseñas',
};

export default async function CoveragePage() {
  const { active, repo } = await requireContext();
  const [sources, coverage] = await Promise.all([
    repo.sources(active.organization.id),
    repo.coverage(active.organization.id),
  ]);
  return (
    <>
      <PageHeader
        layer="operational"
        title="Fuentes y cobertura"
        description="Qué se escucha realmente, de qué cuentas, en qué periodo y qué tipo de dato. Lo que no aparece como conectado NO se está escuchando."
      />
      <Card
        className="overflow-x-auto p-0"
        scrollLabel="Tabla de fuentes conectadas"
      >
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="p-3">Fuente</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Etapa técnica</th>
              <th className="p-3">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="p-3 font-medium">
                  {PROVIDER_CATALOG[s.provider].label}
                </td>
                <td className="p-3">
                  <Badge t={STATUS[s.status].t}>{STATUS[s.status].label}</Badge>
                  {s.ingestionPaused && s.status !== 'not_connected' && (
                    <Badge className="ml-1">Ingesta pausada</Badge>
                  )}
                </td>
                <td className="text-muted-foreground p-3 text-xs">
                  {PROVIDER_CATALOG[s.provider].stage === 'implemented_disabled'
                    ? 'Conector listo, deshabilitado'
                    : PROVIDER_CATALOG[s.provider].stage === 'demo'
                      ? 'Demostración'
                      : 'Solo contrato'}
                </td>
                <td className="text-muted-foreground p-3 text-xs">
                  {s.statusReason ?? PROVIDER_CATALOG[s.provider].note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium">
        Matriz de cobertura por red y tipo de dato
      </h2>
      <Card
        className="overflow-x-auto p-0"
        scrollLabel="Tabla de cobertura por red y tipo de dato"
      >
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr>
              <th className="p-3">Red</th>
              <th className="p-3">Dato</th>
              <th className="p-3">Fuente</th>
              <th className="p-3">Cobertura</th>
              <th className="p-3">Cuenta</th>
              <th className="p-3">Periodo</th>
              <th className="p-3 text-right">Items</th>
              <th className="p-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {coverage.map((c) => (
              <tr key={c.id}>
                <td className="p-3">{PLATFORM_LABEL[c.platform]}</td>
                <td className="p-3">{KIND[c.dataKind]}</td>
                <td className="p-3 text-xs">
                  {PROVIDER_CATALOG[c.provider]?.label ?? c.provider}
                </td>
                <td className="p-3">
                  <CoverageBadge s={c.status} />
                </td>
                <td className="text-muted-foreground p-3 text-xs">
                  {c.accountHandle ?? '—'}
                </td>
                <td className="text-muted-foreground p-3 text-xs">
                  {c.status === 'complete' || c.status === 'partial'
                    ? `desde ${fmtDateTime(c.periodStart)}`
                    : '—'}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {c.itemsIngested}
                </td>
                <td className="text-muted-foreground p-3 text-xs">
                  {c.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium">
        Procedimiento de conexión segura · Metricool (plan Advanced)
      </h2>
      <Card>
        <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Autorización escrita del cliente: cuentas incluidas, usuarios con
            acceso, uso de los datos y retención de 90 días.
          </li>
          <li>
            Confirmar en Metricool qué marca (blogId) y qué redes están
            conectadas para el cliente.
          </li>
          <li>
            Entrega del token API por un canal seguro: nunca por chat, correo ni
            repositorio. Se carga solo como secreto del servidor y se cifra
            (AES-256-GCM).
          </li>
          <li>
            Prueba de permisos sin leer contenido:{' '}
            <code>/v2/inbox/post-comments/authorizations</code> por red.
          </li>
          <li>
            Lectura acotada de prueba (ventana de 24 h, límite bajo), con
            revisión del resultado antes de activar la ingesta periódica.
          </li>
          <li>
            Activación con límites diarios, ingesta pausable y cobertura
            registrada por red y tipo de dato.
          </li>
        </ol>
        <p className="text-muted-foreground mt-3 text-xs">
          El conector usa una lista blanca de endpoints de solo lectura:
          Metricool expone acciones de escritura (borrar comentarios, crear
          campañas pagadas, seguir cuentas) que Hey Foxy nunca invoca.
        </p>
      </Card>
    </>
  );
}
