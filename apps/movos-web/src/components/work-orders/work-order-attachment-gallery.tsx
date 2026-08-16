'use client';

import * as React from 'react';
import { FileImage, FileVideo, Loader2 } from 'lucide-react';

import type { ApiWorkOrderAttachment } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { getEvidenceViewUrl } from '@/lib/evidence';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * WO-ARGOS-049 — read-only evidence display, shared by /work-orders/[id]
 * (operator) and /my-work/[id] (technician). Deliberately lazy: no signed
 * URL is fetched until the technician/operator actually asks to view an
 * item — every view is a fresh, short-lived authorization, never a stored
 * or reused link, matching the private-store design.
 */
export function WorkOrderAttachmentGallery({
  workOrderId,
  surface,
  attachments,
}: {
  workOrderId: string;
  surface: 'my-work' | 'work-orders';
  attachments: ApiWorkOrderAttachment[];
}) {
  if (attachments.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Sin evidencia fotográfica o de video todavía.
      </p>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {attachments.map((attachment) => (
        <AttachmentRow
          key={attachment.id}
          workOrderId={workOrderId}
          surface={surface}
          attachment={attachment}
        />
      ))}
    </div>
  );
}

function AttachmentRow({
  workOrderId,
  surface,
  attachment,
}: {
  workOrderId: string;
  surface: 'my-work' | 'work-orders';
  attachment: ApiWorkOrderAttachment;
}) {
  const [state, setState] = React.useState<'idle' | 'loading' | 'error'>(
    'idle',
  );
  const Icon = attachment.kind === 'VIDEO' ? FileVideo : FileImage;

  async function view(): Promise<void> {
    setState('loading');
    try {
      const fresh = await getEvidenceViewUrl(
        workOrderId,
        attachment.id,
        surface,
      );
      setState('idle');
      window.open(fresh, '_blank', 'noopener,noreferrer');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="border-border flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate">
          {attachment.originalFilename ?? attachment.kind}
        </p>
        <p className="text-muted-foreground">
          {attachment.uploadedByName ?? 'Desconocido'} ·{' '}
          {formatBytes(attachment.fileSizeBytes)}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={state === 'loading'}
        onClick={() => void view()}
      >
        {state === 'loading' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          'Ver'
        )}
      </Button>
      {state === 'error' && (
        <span className="text-red-400">Error al cargar</span>
      )}
    </div>
  );
}
