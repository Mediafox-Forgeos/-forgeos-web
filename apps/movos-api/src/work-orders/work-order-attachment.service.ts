import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WorkOrderAttachment } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { WorkOrderWithNames } from './work-order.service';
import {
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_SIZE_BYTES,
  attachmentKindForMimeType,
} from './attachment-constraints';

const TERMINAL_STATUSES = ['RESOLVED', 'CANCELLED'];

const WORK_ORDER_ATTACHMENT_WITH_UPLOADER_INCLUDE = {
  uploadedBy: { select: { displayName: true } },
} as const;

export type WorkOrderAttachmentWithUploader = WorkOrderAttachment & {
  uploadedBy: { displayName: string };
};

export interface AuthorizeUploadInput {
  mimeType: string;
  fileSizeBytes: number;
  eventId?: string;
}

export interface CreateAttachmentInput {
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  originalFilename?: string;
  eventId?: string;
}

/**
 * WO-ARGOS-049 — field evidence. Deliberately does not re-verify tenant or
 * ownership itself: callers (MyWorkService today) resolve and verify the
 * WorkOrder first, the same discipline MyWorkService's own
 * buildChecklistPayload already follows for checklist events. This service
 * only knows attachment-specific rules — MIME/size constraints (checked
 * against the single shared-types source of truth also used by movos-web's
 * upload route), that an eventId, if given, really belongs to this
 * WorkOrder, and the Prisma reads/writes. The binary itself is never
 * touched here — only Vercel Blob (movos-web) ever holds it; this service
 * persists opaque storage identity/metadata only, never a URL.
 */
@Injectable()
export class WorkOrderAttachmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Called by MyWorkController before movos-web mints a Blob client
   * upload token — never trust the browser's own declared MIME/size. */
  async authorizeUpload(
    workOrder: WorkOrderWithNames,
    input: AuthorizeUploadInput,
  ): Promise<void> {
    this.assertNotTerminal(workOrder);
    this.assertMimeAndSize(input.mimeType, input.fileSizeBytes);
    if (input.eventId) {
      await this.assertEventBelongsToWorkOrder(workOrder.id, input.eventId);
    }
  }

  async createAttachment(
    workOrder: WorkOrderWithNames,
    uploadedById: string,
    input: CreateAttachmentInput,
  ): Promise<WorkOrderAttachmentWithUploader> {
    this.assertNotTerminal(workOrder);
    const kind = this.assertMimeAndSize(input.mimeType, input.fileSizeBytes);
    if (input.eventId) {
      await this.assertEventBelongsToWorkOrder(workOrder.id, input.eventId);
    }
    if (!input.storagePath || input.storagePath.trim().length === 0) {
      throw new BadRequestException('Se requiere la ruta de almacenamiento.');
    }

    return this.prisma.workOrderAttachment.create({
      data: {
        workOrderId: workOrder.id,
        eventId: input.eventId ?? null,
        uploadedById,
        kind,
        mimeType: input.mimeType,
        originalFilename: input.originalFilename ?? null,
        fileSizeBytes: input.fileSizeBytes,
        storageProvider: 'VERCEL_BLOB',
        storagePath: input.storagePath,
      },
      include: WORK_ORDER_ATTACHMENT_WITH_UPLOADER_INCLUDE,
    });
  }

  async list(workOrderId: string): Promise<WorkOrderAttachmentWithUploader[]> {
    return this.prisma.workOrderAttachment.findMany({
      where: { workOrderId },
      include: WORK_ORDER_ATTACHMENT_WITH_UPLOADER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOne(
    workOrderId: string,
    attachmentId: string,
  ): Promise<WorkOrderAttachmentWithUploader> {
    const attachment = await this.prisma.workOrderAttachment.findFirst({
      where: { id: attachmentId, workOrderId },
      include: WORK_ORDER_ATTACHMENT_WITH_UPLOADER_INCLUDE,
    });
    if (!attachment) {
      throw new NotFoundException('Evidencia no encontrada.');
    }
    return attachment;
  }

  private assertNotTerminal(workOrder: WorkOrderWithNames): void {
    if (TERMINAL_STATUSES.includes(workOrder.status)) {
      throw new BadRequestException(
        'No se puede adjuntar evidencia a una orden de trabajo cerrada.',
      );
    }
  }

  private assertMimeAndSize(
    mimeType: string,
    fileSizeBytes: number,
  ): 'IMAGE' | 'VIDEO' {
    const kind = attachmentKindForMimeType(mimeType);
    const allowed = ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[];
    if (!kind || !allowed.includes(mimeType)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${mimeType}.`,
      );
    }
    const maxBytes = ATTACHMENT_MAX_SIZE_BYTES[kind];
    if (fileSizeBytes <= 0 || fileSizeBytes > maxBytes) {
      throw new BadRequestException(
        `El archivo excede el tamaño máximo permitido (${Math.round(maxBytes / (1024 * 1024))} MB).`,
      );
    }
    return kind;
  }

  private async assertEventBelongsToWorkOrder(
    workOrderId: string,
    eventId: string,
  ): Promise<void> {
    const event = await this.prisma.workOrderEvent.findFirst({
      where: { id: eventId, workOrderId },
    });
    if (!event) {
      throw new BadRequestException(
        'El evento indicado no pertenece a esta orden de trabajo.',
      );
    }
  }
}
