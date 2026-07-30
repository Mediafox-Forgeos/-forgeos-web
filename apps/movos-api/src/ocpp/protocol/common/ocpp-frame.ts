import type { MalformedFrame, RawFrame } from './normalized-events';

/**
 * OCPP-J transport envelope, shared by both 1.6J and 2.0.1:
 *   CALL:       [2, "<uniqueId>", "<action>", {payload}]
 *   CALLRESULT: [3, "<uniqueId>", {payload}]
 *   CALLERROR:  [4, "<uniqueId>", "<errorCode>", "<errorDescription>", {details}]
 */
export type OcppJCall = {
  kind: 'CALL';
  messageId: string;
  action: string;
  payload: Record<string, unknown>;
};

export type OcppJCallResult = {
  kind: 'CALLRESULT';
  messageId: string;
  payload: Record<string, unknown>;
};

export type OcppJCallError = {
  kind: 'CALLERROR';
  messageId: string;
  errorCode: string;
  errorDescription: string;
  details: Record<string, unknown>;
};

export type OcppJMessage = OcppJCall | OcppJCallResult | OcppJCallError;

const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;

/** Parses the shared OCPP-J array envelope. Never throws — a structurally
 * invalid frame is a MalformedFrame, a normal outcome this design accounts
 * for, not an exceptional one. */
export function parseOcppJFrame(
  frame: RawFrame,
): OcppJMessage | MalformedFrame {
  const raw = frame.raw;
  if (!Array.isArray(raw) || raw.length < 3) {
    return {
      kind: 'MalformedFrame',
      description: 'Frame is not a valid OCPP-J array',
    };
  }

  const [messageTypeId, messageId] = raw as unknown[];
  if (typeof messageTypeId !== 'number' || typeof messageId !== 'string') {
    return {
      kind: 'MalformedFrame',
      description:
        'Frame is missing a numeric messageTypeId or string messageId',
    };
  }

  if (messageTypeId === CALL) {
    const [, , action, payload] = raw as unknown[];
    if (
      typeof action !== 'string' ||
      typeof payload !== 'object' ||
      payload === null
    ) {
      return {
        kind: 'MalformedFrame',
        description: 'CALL frame is missing action or payload',
      };
    }
    return {
      kind: 'CALL',
      messageId,
      action,
      payload: payload as Record<string, unknown>,
    };
  }

  if (messageTypeId === CALLRESULT) {
    const [, , payload] = raw as unknown[];
    if (typeof payload !== 'object' || payload === null) {
      return {
        kind: 'MalformedFrame',
        description: 'CALLRESULT frame is missing payload',
      };
    }
    return {
      kind: 'CALLRESULT',
      messageId,
      payload: payload as Record<string, unknown>,
    };
  }

  if (messageTypeId === CALLERROR) {
    const [, , errorCode, errorDescription, details] = raw as unknown[];
    if (typeof errorCode !== 'string' || typeof errorDescription !== 'string') {
      return {
        kind: 'MalformedFrame',
        description: 'CALLERROR frame is missing errorCode or errorDescription',
      };
    }
    return {
      kind: 'CALLERROR',
      messageId,
      errorCode,
      errorDescription,
      details: (details as Record<string, unknown>) ?? {},
    };
  }

  return {
    kind: 'MalformedFrame',
    description: `Unknown messageTypeId ${String(messageTypeId)}`,
  };
}

/** Builds an outbound CALL frame. Used by the simulator (client-side, to
 * send BootNotification/Heartbeat/StatusNotification) and reserved for the
 * engine's own future outbound commands (Architecture Backlog #36-39, not
 * implemented by CAP-003). */
export function formatCall(
  messageId: string,
  action: string,
  payload: Record<string, unknown>,
): RawFrame {
  return { raw: [CALL, messageId, action, payload] };
}

export function formatCallResult(
  messageId: string,
  payload: Record<string, unknown>,
): RawFrame {
  return { raw: [CALLRESULT, messageId, payload] };
}

export function formatCallError(
  messageId: string,
  errorCode: string,
  errorDescription: string,
  details: Record<string, unknown> = {},
): RawFrame {
  return { raw: [CALLERROR, messageId, errorCode, errorDescription, details] };
}
