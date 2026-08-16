'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { ATTACHMENT_ALLOWED_MIME_TYPES } from '@mediafox/shared-types';

import { Button } from '@/components/ui/button';
import { uploadEvidence } from '@/lib/evidence';

/**
 * WO-ARGOS-049 — mobile-first evidence capture. Three controls, matching
 * the design's exact scope: take a photo (rear camera via `capture`),
 * pick from the gallery (any allowed type), or attach a video. Kept
 * deliberately simple — no crop/edit/multi-select, no media-management UI.
 */
export function WorkOrderEvidenceCapture({
  workOrderId,
  eventId,
  onUploaded,
}: {
  workOrderId: string;
  eventId?: string;
  onUploaded: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      await uploadEvidence(file, { workOrderId, eventId });
      onUploaded();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al subir la evidencia.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept={ATTACHMENT_ALLOWED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => cameraInputRef.current?.click()}
      >
        Tomar foto
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => galleryInputRef.current?.click()}
      >
        Elegir de galería
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => videoInputRef.current?.click()}
      >
        Adjuntar video
      </Button>
      {pending && (
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
