import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Tabs } from '@/components/movos/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { tenant } from '@/config/tenant';

type Field = { label: string; value: string; hint?: string };

function SettingsSection({
  description,
  fields,
}: {
  description: string;
  fields: Field[];
}) {
  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <p className="text-muted-foreground text-sm">{description}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label}>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">
                {field.label}
              </label>
              <Input defaultValue={field.value} disabled />
              {field.hint && (
                <p className="text-muted-foreground mt-1 text-[11px]">
                  {field.hint}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled>
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description="Ajustes de la organización, marca y plataforma. Sin persistencia en el entorno piloto."
      />

      <div className="mt-8">
        <Tabs
          items={[
            {
              id: 'org',
              label: 'Organización',
              content: (
                <SettingsSection
                  description="Datos de la organización operadora."
                  fields={[
                    { label: 'Nombre', value: tenant.orgName },
                    { label: 'Descripción', value: tenant.orgDescription },
                    { label: 'País', value: 'Colombia' },
                  ]}
                />
              ),
            },
            {
              id: 'brand',
              label: 'Marca white-label',
              content: (
                <SettingsSection
                  description="Identidad de marca del producto. Estos valores provienen de la configuración de tenant y re-marcan toda la aplicación."
                  fields={[
                    { label: 'Nombre del producto', value: tenant.productName },
                    {
                      label: 'Descriptor',
                      value: tenant.productDescriptor,
                    },
                    {
                      label: 'Color de acento',
                      value: tenant.accentColor,
                      hint: 'Token CSS de la paleta de marca.',
                    },
                  ]}
                />
              ),
            },
            {
              id: 'currency',
              label: 'Moneda',
              content: (
                <SettingsSection
                  description="Moneda usada para tarifas e ingresos."
                  fields={[{ label: 'Moneda', value: tenant.currency }]}
                />
              ),
            },
            {
              id: 'locale',
              label: 'Idioma',
              content: (
                <SettingsSection
                  description="Configuración regional de la interfaz."
                  fields={[{ label: 'Locale', value: tenant.locale }]}
                />
              ),
            },
            {
              id: 'operators',
              label: 'Operadores',
              content: (
                <SettingsSection
                  description="Gestión de operadores. La administración de accesos estará disponible con autenticación."
                  fields={[
                    { label: 'Operadores activos', value: '3' },
                    { label: 'Invitaciones pendientes', value: '1' },
                  ]}
                />
              ),
            },
            {
              id: 'integrations',
              label: 'Integraciones',
              content: (
                <SettingsSection
                  description="Conexiones con sistemas externos."
                  fields={[
                    { label: 'Facturación', value: 'No conectado' },
                    { label: 'Roaming', value: 'No conectado' },
                  ]}
                />
              ),
            },
            {
              id: 'ocpp',
              label: 'OCPP',
              content: (
                <SettingsSection
                  description="Parámetros del backend OCPP. La conexión en vivo se habilitará en una misión posterior."
                  fields={[
                    { label: 'Versión soportada', value: 'OCPP 1.6J' },
                    { label: 'Endpoint', value: 'No configurado' },
                  ]}
                />
              ),
            },
            {
              id: 'notifications',
              label: 'Notificaciones',
              content: (
                <SettingsSection
                  description="Canales de notificación de alertas."
                  fields={[
                    { label: 'Correo', value: 'No configurado' },
                    { label: 'Webhook', value: 'No configurado' },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}
