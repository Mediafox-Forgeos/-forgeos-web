import type { IncidentStatus, Role } from '@/lib/types';

/** Espejo de public.hf_incident_transition_allowed (la base es la autoridad). */
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['acknowledged', 'false_positive'],
  acknowledged: ['investigating', 'false_positive'],
  investigating: ['responding', 'monitoring', 'false_positive'],
  responding: ['monitoring', 'resolved'],
  monitoring: ['responding', 'resolved'],
  resolved: ['closed', 'investigating'],
  closed: [],
  false_positive: [],
};

export const INCIDENT_LABEL: Record<IncidentStatus, string> = {
  open: 'Abierto',
  acknowledged: 'Reconocido',
  investigating: 'En investigación',
  responding: 'Respondiendo',
  monitoring: 'En monitoreo',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  false_positive: 'Falso positivo',
};

export function canTransition(
  from: IncidentStatus,
  to: IncidentStatus,
): boolean {
  return INCIDENT_TRANSITIONS[from].includes(to);
}

export function requiresResolutionSummary(to: IncidentStatus): boolean {
  return to === 'closed' || to === 'false_positive';
}

export const INCIDENT_MANAGERS: Role[] = [
  'owner',
  'admin',
  'analyst',
  'responder',
];
export function canManageIncidents(role: Role): boolean {
  return INCIDENT_MANAGERS.includes(role);
}
export function canReviewAlerts(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'analyst';
}
export function canConfigure(role: Role): boolean {
  return role === 'owner' || role === 'admin';
}
