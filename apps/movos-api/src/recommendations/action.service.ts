import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Action, ActionStatus, RecommendationType } from '@prisma/client';
import type { ActionTransition } from '@mediafox/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import { RecommendationService } from './recommendation.service';

const COOLDOWN_MS = 60 * 60_000; // 60 minutes

const TERMINAL_STATUSES: ActionStatus[] = ['RESOLVED', 'DISMISSED'];

const ACTION_WITH_NAMES_INCLUDE = {
  chargingStation: { select: { name: true } },
  assignedTo: { select: { displayName: true } },
} as const;

export type ActionWithNames = Action & {
  chargingStation: { name: string };
  assignedTo: { displayName: string } | null;
};

// Objective 3's five states, reached by Objective 1's four named actions
// plus one unnamed fifth (`dismiss`) — see
// docs/implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md's "the
// fifth action" note for why DISMISSED needs a trigger the work order's own
// action list didn't enumerate. `OPEN` never appears as a map key here
// because no persisted Action is ever created while still OPEN — see the
// same document's "why OPEN is never persisted" note.
const VALID_TRANSITIONS: Record<ActionStatus, ActionTransition[]> = {
  OPEN: ['acknowledge', 'assign', 'snooze', 'resolve', 'dismiss'],
  ACKNOWLEDGED: ['assign', 'snooze', 'resolve', 'dismiss'],
  ASSIGNED: ['snooze', 'resolve', 'dismiss'],
  RESOLVED: [],
  DISMISSED: [],
};

export interface TransitionInput {
  transition: ActionTransition;
  assignedToUserId?: string;
  notes?: string;
  snoozeMinutes?: number;
}

export interface CreateActionInput extends TransitionInput {
  recommendationType: RecommendationType;
  stationId: string;
}

/**
 * Operational Execution Layer (WO-ARGOS-026). Owns the one write path onto
 * `Action` — RecommendationService itself remains pure/stateless, exactly
 * as it was built in WO-ARGOS-025; this service is additive, not a
 * modification of it.
 */
@Injectable()
export class ActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendations: RecommendationService,
  ) {}

  /**
   * The Action currently relevant to one live recommendation, if any — a
   * non-terminal Action (still being worked), or a terminal one still
   * inside its cooldown window (resolved/dismissed recently enough that
   * re-litigating it immediately would be noise). Returns null once
   * neither applies, at which point the recommendation reads as fresh
   * again even if an old, expired Action row still exists for the same
   * station/type.
   */
  async findRelevant(
    organizationId: string,
    stationId: string,
    recommendationType: RecommendationType,
  ): Promise<ActionWithNames | null> {
    const latest = await this.prisma.action.findFirst({
      where: {
        organizationId,
        chargingStationId: stationId,
        recommendationType,
      },
      include: ACTION_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) return null;
    if (!TERMINAL_STATUSES.includes(latest.status)) return latest;

    const closedAt = latest.resolvedAt ?? latest.updatedAt;
    const withinCooldown = Date.now() - closedAt.getTime() < COOLDOWN_MS;
    return withinCooldown ? latest : null;
  }

  async list(
    organizationId: string,
    status?: ActionStatus,
  ): Promise<ActionWithNames[]> {
    return this.prisma.action.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: ACTION_WITH_NAMES_INCLUDE,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  /**
   * The entry point for a recommendation's first operator interaction. If
   * a relevant Action already exists (see findRelevant), the requested
   * transition is applied to it instead of creating a duplicate row for
   * the same live problem.
   */
  async create(
    organizationId: string,
    input: CreateActionInput,
  ): Promise<ActionWithNames> {
    const existing = await this.findRelevant(
      organizationId,
      input.stationId,
      input.recommendationType,
    );
    if (existing && !TERMINAL_STATUSES.includes(existing.status)) {
      return this.transition(organizationId, existing.id, input);
    }

    const live = await this.recommendations.getAll(organizationId);
    const match = live.find(
      (r) =>
        r.type === input.recommendationType && r.stationId === input.stationId,
    );
    if (!match) {
      throw new NotFoundException(
        'La condición que originó esta recomendación ya no está presente.',
      );
    }

    await this.assertValidTransition('OPEN', input.transition);
    if (input.transition === 'assign') {
      await this.assertAssignee(organizationId, input.assignedToUserId);
    }

    const created = await this.prisma.action.create({
      data: {
        organizationId,
        chargingStationId: input.stationId,
        recommendationType: input.recommendationType,
        title: match.title,
        severity: match.severity,
        explanation: match.explanation,
        evidence: match.evidence,
        recommendedAction: match.recommendedAction,
        status: 'OPEN',
      },
    });

    return this.applyTransition(created, input);
  }

  async transition(
    organizationId: string,
    actionId: string,
    input: TransitionInput,
  ): Promise<ActionWithNames> {
    const action = await this.prisma.action.findFirst({
      where: { id: actionId, organizationId },
    });
    if (!action) {
      throw new NotFoundException('Acción no encontrada.');
    }

    await this.assertValidTransition(action.status, input.transition);
    if (input.transition === 'assign') {
      await this.assertAssignee(organizationId, input.assignedToUserId);
    }

    return this.applyTransition(action, input);
  }

  private async assertValidTransition(
    from: ActionStatus,
    transition: ActionTransition,
  ): Promise<void> {
    if (!VALID_TRANSITIONS[from].includes(transition)) {
      throw new ConflictException(
        `La acción "${transition}" no es válida desde el estado ${from}.`,
      );
    }
  }

  private async assertAssignee(
    organizationId: string,
    assignedToUserId: string | undefined,
  ): Promise<void> {
    if (!assignedToUserId) {
      throw new BadRequestException(
        'Se requiere un usuario para asignar esta acción.',
      );
    }
    // Assignment is constrained to a real, active Membership of this
    // organization — the same constraint CAP-X_CONTRACTS.md's own
    // (never-built) Incident.assigneeUserId design already specified, kept
    // here rather than inventing a new identity concept.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: assignedToUserId, organizationId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new BadRequestException(
        'El usuario asignado no tiene una membresía activa en esta organización.',
      );
    }
  }

  private async applyTransition(
    action: Action,
    input: TransitionInput,
  ): Promise<ActionWithNames> {
    switch (input.transition) {
      case 'acknowledge':
        return this.prisma.action.update({
          where: { id: action.id },
          data: { status: 'ACKNOWLEDGED' },
          include: ACTION_WITH_NAMES_INCLUDE,
        });

      case 'assign':
        return this.prisma.action.update({
          where: { id: action.id },
          data: {
            status: 'ASSIGNED',
            assignedToUserId: input.assignedToUserId,
          },
          include: ACTION_WITH_NAMES_INCLUDE,
        });

      case 'snooze': {
        const minutes = input.snoozeMinutes ?? 60;
        if (minutes < 1 || minutes > 7 * 24 * 60) {
          throw new BadRequestException(
            'El tiempo de posposición debe estar entre 1 minuto y 7 días.',
          );
        }
        return this.prisma.action.update({
          where: { id: action.id },
          data: {
            snoozedUntil: new Date(Date.now() + minutes * 60_000),
            // Snoozing implies acknowledgment — silently leaving an OPEN
            // action snoozed with no other status change would misrepresent
            // it as still untouched.
            status: action.status === 'OPEN' ? 'ACKNOWLEDGED' : action.status,
          },
          include: ACTION_WITH_NAMES_INCLUDE,
        });
      }

      case 'resolve':
        if (!input.notes) {
          throw new BadRequestException(
            'Se requiere una nota de resolución para resolver esta acción.',
          );
        }
        return this.prisma.action.update({
          where: { id: action.id },
          data: {
            status: 'RESOLVED',
            notes: input.notes,
            resolvedAt: new Date(),
          },
          include: ACTION_WITH_NAMES_INCLUDE,
        });

      case 'dismiss':
        if (!input.notes) {
          throw new BadRequestException(
            'Se requiere un motivo para descartar esta acción.',
          );
        }
        return this.prisma.action.update({
          where: { id: action.id },
          data: {
            status: 'DISMISSED',
            notes: input.notes,
            resolvedAt: new Date(),
          },
          include: ACTION_WITH_NAMES_INCLUDE,
        });

      default:
        throw new BadRequestException(
          `Transición desconocida: ${input.transition}`,
        );
    }
  }
}
