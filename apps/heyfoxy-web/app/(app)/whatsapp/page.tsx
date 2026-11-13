import { Badge, Card, PageHeader, SeverityBadge } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { maskPhone } from '@/lib/mask';
import { canConfigure } from '@/lib/incidents/fsm';
import { WA_TEMPLATES } from '@/lib/whatsapp/templates';
import { whatsappMode } from '@/lib/env';

export const metadata = { title: 'WhatsApp' };

export default async function WhatsAppPage() {
  const { active, repo } = await requireContext();
  const admin = canConfigure(active.role);
  const [recipients, dispatches] = await Promise.all([
    admin ? repo.waRecipients(active.organization.id) : Promise.resolve([]),
    admin ? repo.waDispatches(active.organization.id) : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        layer="platform"
        title="WhatsApp"
        description="Alertas individuales (1:1) con plantillas de utilidad aprobadas por Meta. No se usan grupos."
        actions={
          <Badge t="amber">
            Modo:{' '}
            {whatsappMode() === 'simulate'
              ? 'Simulación (sin envíos reales)'
              : 'Sandbox'}
          </Badge>
        }
      />
      {!admin ? (
        <p className="text-muted-foreground text-sm">
          Solo owner/admin pueden ver destinatarios (datos personales).
        </p>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="p-3">Destinatario</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Umbral</th>
                  <th className="p-3">Consentimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3">{r.displayName}</td>
                    <td className="p-3 font-mono text-xs">
                      {maskPhone(r.phoneE164)}
                    </td>
                    <td className="p-3">
                      <SeverityBadge s={r.minSeverity} />
                    </td>
                    <td className="p-3">
                      {r.optedInAt ? (
                        <Badge t="green">Opt-in registrado</Badge>
                      ) : (
                        <Badge t="red">Sin opt-in: no recibe</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <h2 className="mb-2 mt-6 text-sm font-medium">
            Último despacho (simulado)
          </h2>
          <Card className="space-y-2">
            {dispatches.length === 0 && (
              <p className="text-muted-foreground text-sm">Sin despachos.</p>
            )}
            {dispatches.map((d) => (
              <div
                key={d.idempotencyKey}
                className="flex flex-wrap items-start justify-between gap-2 border-b pb-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-muted-foreground font-mono text-xs">
                    {d.template}
                  </p>
                  {d.preview && <p className="mt-0.5">{d.preview}</p>}
                  <p className="text-muted-foreground text-xs">
                    {
                      recipients.find((r) => r.id === d.recipientId)
                        ?.displayName
                    }
                    : {d.reason}
                  </p>
                </div>
                <Badge t={d.status === 'simulated' ? 'blue' : 'neutral'}>
                  {d.status === 'simulated' ? 'Simulado' : 'Suprimido'}
                </Badge>
              </div>
            ))}
          </Card>
        </>
      )}
      <h2 className="mb-2 mt-6 text-sm font-medium">
        Plantillas (pendientes de aprobación en Meta)
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {Object.values(WA_TEMPLATES).map((t) => (
          <Card key={t.name} className="p-3">
            <p className="text-brand font-mono text-xs">{t.name}</p>
            <p className="mt-1 text-sm">{t.body}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Botones: {t.buttons.join(' · ')}
            </p>
          </Card>
        ))}
      </div>
    </>
  );
}
