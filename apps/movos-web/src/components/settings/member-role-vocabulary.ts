/**
 * WO-ARGOS-089 — display labels and the assignable-roles-by-actor rule.
 * UX only, mirroring MembershipsService's own boundary
 * (ADMIN_MANAGEABLE_ROLES) so the dropdown never offers a choice the
 * backend would reject — but the backend re-validates every one of these
 * independently and is the real authority, not this file.
 */
export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  SUPPORT: 'Soporte',
  ANALYST: 'Analista',
  VIEWER: 'Solo lectura',
  TECHNICIAN: 'Técnico',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  INVITED: 'Invitado',
};

const ALL_ROLES = [
  'OWNER',
  'ADMIN',
  'OPERATOR',
  'SUPPORT',
  'ANALYST',
  'VIEWER',
  'TECHNICIAN',
];

const ADMIN_MANAGEABLE_ROLES = [
  'OPERATOR',
  'SUPPORT',
  'ANALYST',
  'VIEWER',
  'TECHNICIAN',
];

export function assignableRoles(actorRole: string | undefined): string[] {
  return actorRole === 'OWNER' ? ALL_ROLES : ADMIN_MANAGEABLE_ROLES;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
