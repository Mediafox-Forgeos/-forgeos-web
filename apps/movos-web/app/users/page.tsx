import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { UserStatusBadge } from '@/components/movos/status-badge';
import { Badge } from '@/components/ui/badge';
import { users } from '@/data/users';
import { formatRelative } from '@/lib/format';
import type { User } from '@/types';

const columns: Column<User>[] = [
  { key: 'name', header: 'Nombre', render: (u) => u.name },
  { key: 'email', header: 'Correo', render: (u) => u.email },
  {
    key: 'role',
    header: 'Rol',
    render: (u) => <Badge tone="info">{u.role}</Badge>,
  },
  { key: 'org', header: 'Organización', render: (u) => u.organizationName },
  {
    key: 'status',
    header: 'Estado',
    render: (u) => <UserStatusBadge status={u.status} />,
  },
  {
    key: 'activity',
    header: 'Última actividad',
    render: (u) => formatRelative(u.lastActivity),
  },
];

export default function UsersPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Operadores con acceso a la plataforma. La autenticación aún no está conectada."
      />
      <div className="mt-8">
        <DataTable columns={columns} rows={users} getRowKey={(u) => u.id} />
      </div>
    </PageContainer>
  );
}
