import { Injectable, Logger } from '@nestjs/common';

export type PendingCallResolution =
  | { kind: 'CALLRESULT'; payload: Record<string, unknown> }
  | {
      kind: 'CALLERROR';
      errorCode: string;
      errorDescription: string;
      details: Record<string, unknown>;
    };

interface PendingCallEntry {
  ocppIdentity: string;
  resolve: (resolution: PendingCallResolution) => void;
  onTimeout: () => void;
  timer: NodeJS.Timeout;
}

export const DEFAULT_COMMAND_RESPONSE_TIMEOUT_MS = 30_000;

/**
 * WO-ARGOS-059 — the server-side mirror of the pending-call tracking the
 * OCPP simulator already does client-side (its own `pending: Map<messageId,
 * {resolve,reject}>` in ocpp-simulator.ts's call() method) — WO-058
 * discovery found the server had no equivalent at all. This is a pure
 * transport-layer concern: it correlates an outbound CALL's message id to
 * its eventual CALLRESULT/CALLERROR, nothing more. It never inspects OCPP
 * command semantics (Accepted/Rejected/Scheduled) or touches domain state —
 * that interpretation belongs to whoever registered the pending call
 * (RemoteCommandService).
 *
 * "Unknown/stale response IDs must be handled safely and audibly" (WO-059
 * scope item 4): OcppMessageRouterService checks `has()` before calling
 * `resolve()` — an unmatched messageId is a router-level concern (logged as
 * UNSUPPORTED via OcppProtocolEventService, unchanged from before this WO),
 * never reaches this class as an error.
 *
 * "Pending calls must not live forever" / "deterministic timeout behavior"
 * (same scope item): every registration owns its own setTimeout; on
 * timeout, the entry is removed and onTimeout() fires exactly once. A
 * connection dropping mid-command is not actively detected here — it is
 * handled by the same timeout firing once the deadline passes, since no
 * CALLRESULT/CALLERROR will ever arrive on a dead socket (WO-058 decision:
 * "must eventually resolve honestly — normally TIMED_OUT," not instant
 * detection).
 */
@Injectable()
export class PendingCallRegistryService {
  private readonly logger = new Logger(PendingCallRegistryService.name);
  private readonly pending = new Map<string, PendingCallEntry>();

  register(
    messageId: string,
    ocppIdentity: string,
    handlers: {
      resolve: (resolution: PendingCallResolution) => void;
      onTimeout: () => void;
    },
    timeoutMs: number = DEFAULT_COMMAND_RESPONSE_TIMEOUT_MS,
  ): void {
    const timer = setTimeout(() => {
      this.pending.delete(messageId);
      handlers.onTimeout();
    }, timeoutMs);
    // Never keep the process alive solely for a pending OCPP command
    // response — matches ConnectionRegistryService's own sweep-timer
    // discipline (`.unref?.()`).
    timer.unref?.();

    this.pending.set(messageId, {
      ocppIdentity,
      resolve: handlers.resolve,
      onTimeout: handlers.onTimeout,
      timer,
    });
  }

  has(messageId: string): boolean {
    return this.pending.has(messageId);
  }

  /** Called by OcppMessageRouterService when an inbound CALLRESULT/
   * CALLERROR's messageId matches a pending entry. Idempotent-safe: if the
   * entry is already gone (e.g. it just timed out), this is a no-op rather
   * than an error — a race between "timeout just fired" and "response just
   * arrived" must not throw. */
  resolve(messageId: string, resolution: PendingCallResolution): void {
    const entry = this.pending.get(messageId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(messageId);
    entry.resolve(resolution);
  }

  /** Administrative cleanup — e.g. module shutdown. Fires onTimeout for
   * every still-pending entry rather than leaving callers awaiting
   * forever. */
  cancelAll(): void {
    for (const [messageId, entry] of this.pending) {
      clearTimeout(entry.timer);
      this.pending.delete(messageId);
      try {
        entry.onTimeout();
      } catch (error) {
        this.logger.error(
          `onTimeout callback threw for ${messageId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  /** Diagnostics only. */
  pendingCount(): number {
    return this.pending.size;
  }
}
