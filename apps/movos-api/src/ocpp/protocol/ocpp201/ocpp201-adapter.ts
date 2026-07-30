import { Injectable } from '@nestjs/common';

import { formatCallError, parseOcppJFrame } from '../common/ocpp-frame';
import { CapabilityNotSupportedError } from '../common/errors';
import type {
  DomainResult,
  MalformedFrame,
  NormalizedInboundEvent,
  NormalizedOutboundCommand,
  ParseContext,
  ProtocolAdapter,
  ProtocolCapabilities,
  ProtocolError,
  RawFrame,
  UnsupportedMessage,
} from '../common/normalized-events';

/**
 * OCPP 2.0.1 adapter boundary — per CAP-003 Architecture Decisions
 * Decision 3 (ARGOS-expanded scope), this adapter's *boundary* is real and
 * registered, but it implements no message functionally. Every inbound
 * message it sees resolves to UnsupportedMessage and a protocol-correct
 * CALLERROR — this is a deliberate, tested behavior (never a silent
 * accept), not an oversight. See docs/domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md
 * and docs/architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md (#2).
 */
@Injectable()
export class Ocpp201Adapter implements ProtocolAdapter {
  readonly version = 'OCPP2_0_1' as const;

  readonly capabilities: ProtocolCapabilities = {
    supportedInbound: new Set(),
    supportedOutbound: new Set(),
  };

  parseInbound(
    frame: RawFrame,
    _context: ParseContext,
  ): NormalizedInboundEvent | UnsupportedMessage | MalformedFrame {
    const message = parseOcppJFrame(frame);
    if (message.kind === 'MalformedFrame') {
      return message;
    }
    const action = message.kind === 'CALL' ? message.action : message.kind;
    return { kind: 'UnsupportedMessage', action, reason: 'not_implemented' };
  }

  formatOutbound(command: NormalizedOutboundCommand): RawFrame {
    throw new CapabilityNotSupportedError(command.type, this.version);
  }

  formatResponse(
    _event: NormalizedInboundEvent,
    _result: DomainResult,
    messageId: string,
  ): RawFrame {
    return formatCallError(
      messageId,
      'NotImplemented',
      'OCPP 2.0.1 support is architectural only in this version of MOVOS',
    );
  }

  formatErrorResponse(messageId: string, error: ProtocolError): RawFrame {
    return formatCallError(messageId, 'NotImplemented', error.description);
  }
}
