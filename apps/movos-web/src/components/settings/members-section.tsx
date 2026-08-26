'use client';

import { Users } from 'lucide-react';
import * as React from 'react';
import type {
  ApiMembershipInvitation,
  ApiOrganizationMember,
} from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/movos/empty-state';
import { useAuth } from '@/context/auth-context';
import { listMembers, listPendingInvitations } from '@/lib/memberships-api';
import { AddMemberModal } from './add-member-modal';
import {
  ConfirmMemberChangeModal,
  type PendingMemberChange,
} from './confirm-member-change-modal';
import {
  assignableRoles,
  roleLabel,
  statusLabel,
} from './member-role-vocabulary';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * WO-ARGOS-089 — replaces the previous fake/static "Operadores" tab
 * (hardcoded counts, no real data source) with the real organization member
 * list. Every mutation goes through the backend's own RBAC/tenant/
 * final-owner rules — this component only decides what to *show*, never
 * what to *allow*.
 */
export function MembersSection() {
  const { membership } = useAuth();
  const canManage =
    membership?.role === 'OWNER' || membership?.role === 'ADMIN';

  const [members, setMembers] = React.useState<ApiOrganizationMember[]>([]);
  const [invitations, setInvitations] = React.useState<
    ApiMembershipInvitation[]
  >([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [addOpen, setAddOpen] = React.useState(false);
  const [pendingChange, setPendingChange] =
    React.useState<PendingMemberChange | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    setState('loading');
    try {
      const [membersData, invitationsData] = await Promise.all([
        listMembers(),
        listPendingInvitations(),
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  React.useEffect(() => {
    // GET /memberships is itself OWNER/ADMIN-only server-side — this guard
    // just avoids firing a request an OPERATOR/VIEWER can't use anyway.
    if (!canManage) return;
    void load();
  }, [load, canManage]);

  function applyUpdated(updated: ApiOrganizationMember): void {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  }

  // An ADMIN can only touch OPERATOR/SUPPORT/ANALYST/VIEWER/TECHNICIAN
  // memberships — mirrors MembershipsService's own boundary so the row
  // never dangles a control the backend would reject. OWNER can touch
  // anyone (the final-owner invariant itself is enforced backend-side).
  function canEditRow(member: ApiOrganizationMember): boolean {
    if (!canManage) return false;
    if (membership?.role === 'OWNER') return true;
    return member.role !== 'OWNER' && member.role !== 'ADMIN';
  }

  if (!canManage) {
    return (
      <p className="text-muted-foreground text-sm">
        Solo OWNER o ADMIN pueden ver y administrar los usuarios de la
        organización.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Usuarios con acceso a esta organización.
        </p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          + Agregar usuario
        </Button>
      </div>

      {state === 'loading' && (
        <Card className="h-32 animate-pulse">
          <CardContent className="pt-5">
            <div className="bg-muted h-4 w-1/3 rounded" />
          </CardContent>
        </Card>
      )}

      {state === 'error' && (
        <EmptyState
          icon={Users}
          title="No fue posible cargar los usuarios."
          description="Verifica tu conexión con MOVOS e intenta nuevamente."
          action={
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      )}

      {state === 'ready' && members.length === 0 && (
        <EmptyState
          icon={Users}
          title="No hay usuarios registrados todavía."
          description="Agrega un usuario existente de MOVOS para darle acceso a esta organización."
          action={
            <Button onClick={() => setAddOpen(true)}>Agregar usuario</Button>
          }
        />
      )}

      {state === 'ready' && members.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const editable = canEditRow(member);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.displayName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {member.email}
                      </TableCell>
                      <TableCell>
                        {editable ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              setPendingChange({
                                member,
                                role: e.target.value,
                              })
                            }
                            className="border-input bg-background focus-visible:ring-ring h-9 rounded-lg border px-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                            aria-label={`Rol de ${member.displayName}`}
                          >
                            {assignableRoles(membership?.role).map((r) => (
                              <option key={r} value={r}>
                                {roleLabel(r)}
                              </option>
                            ))}
                            {/* Keep the member's current role selectable/visible
                                even if it falls outside what this actor may
                                assign (e.g. an ADMIN viewing... — this branch
                                only renders for editable rows, which already
                                excludes OWNER/ADMIN targets for an ADMIN actor,
                                but an OWNER always sees every real role). */}
                            {!assignableRoles(membership?.role).includes(
                              member.role,
                            ) && (
                              <option value={member.role}>
                                {roleLabel(member.role)}
                              </option>
                            )}
                          </select>
                        ) : (
                          roleLabel(member.role)
                        )}
                      </TableCell>
                      <TableCell>{statusLabel(member.status)}</TableCell>
                      <TableCell className="text-right">
                        {editable && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPendingChange({
                                member,
                                status:
                                  member.status === 'ACTIVE'
                                    ? 'SUSPENDED'
                                    : 'ACTIVE',
                              })
                            }
                          >
                            {member.status === 'ACTIVE'
                              ? 'Desactivar'
                              : 'Reactivar'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {state === 'ready' && invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Invitaciones pendientes</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Expira</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-mono text-sm">
                        {invitation.email}
                      </TableCell>
                      <TableCell>{roleLabel(invitation.role)}</TableCell>
                      <TableCell>
                        {new Date(invitation.expiresAt).toLocaleString('es-CO')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <AddMemberModal
        open={addOpen}
        actorRole={membership?.role ?? 'VIEWER'}
        onClose={() => setAddOpen(false)}
        onAdded={(created) => setMembers((prev) => [...prev, created])}
        onInvited={(created) =>
          setInvitations((prev) => [
            {
              id: created.id,
              email: created.email,
              role: created.role,
              expiresAt: created.expiresAt,
              createdAt: created.createdAt,
            },
            ...prev,
          ])
        }
      />

      <ConfirmMemberChangeModal
        pending={pendingChange}
        onClose={() => setPendingChange(null)}
        onChanged={applyUpdated}
      />
    </div>
  );
}
