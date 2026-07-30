import type { Duplex } from 'node:stream';
import type { IncomingMessage, Server as HttpServer } from 'node:http';

import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer, type WebSocket } from 'ws';

import type { ChargingStation } from '@prisma/client';

import {
  detectProtocolVersion,
  subprotocolFor,
} from '../protocol/common/protocol-detector';
import type {
  OcppProtocolVersion,
  ProtocolAdapter,
} from '../protocol/common/normalized-events';
import { Ocpp16Adapter } from '../protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from '../protocol/ocpp201/ocpp201-adapter';
import { OcppAuthenticationService } from '../authentication/ocpp-authentication.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { OcppMessageRouterService } from '../routing/ocpp-message-router.service';

const OCPP_PATH_PREFIX = '/ocpp/';

/**
 * The OCPP WebSocket transport — a module inside apps/movos-api, not a
 * separate deployable (CAP-003 Architecture Decisions Decision 4, ADR-0009).
 * Attached to the same HTTP server Express already listens on, via a raw
 * `ws.WebSocketServer` in `noServer` mode: the upgrade handshake needs full
 * manual control (Basic Auth header, subprotocol negotiation, identity
 * resolved from the URL path) that framework-level WebSocket gateways
 * aren't built around for a protocol like OCPP.
 *
 * Connection URL convention: wss://host/ocpp/{ocppIdentity}
 */
@Injectable()
export class OcppWebSocketServer {
  private readonly logger = new Logger(OcppWebSocketServer.name);
  private readonly wss: WebSocketServer;

  constructor(
    private readonly authentication: OcppAuthenticationService,
    private readonly connectionRegistry: ConnectionRegistryService,
    private readonly router: OcppMessageRouterService,
    private readonly ocpp16Adapter: Ocpp16Adapter,
    private readonly ocpp201Adapter: Ocpp201Adapter,
  ) {
    this.wss = new WebSocketServer({
      noServer: true,
      handleProtocols: (protocols: Set<string>) => {
        const version = detectProtocolVersion(Array.from(protocols));
        return version ? subprotocolFor(version) : false;
      },
    });
  }

  attach(httpServer: HttpServer): void {
    httpServer.on(
      'upgrade',
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        void this.handleUpgrade(request, socket, head);
      },
    );
    this.logger.log(
      `OCPP WebSocket transport attached at ${OCPP_PATH_PREFIX}{ocppIdentity}`,
    );
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    const url = request.url ?? '';
    if (!url.startsWith(OCPP_PATH_PREFIX)) {
      // Not an OCPP connection — don't assume ownership of every upgrade on
      // this HTTP server, just decline to handle this one.
      return;
    }

    const ocppIdentity = decodeURIComponent(
      url.slice(OCPP_PATH_PREFIX.length).split('?')[0]?.replace(/\/$/, '') ??
        '',
    );
    if (!ocppIdentity) {
      rejectUpgrade(socket, 400, 'Missing OCPP identity in connection path');
      return;
    }

    const requestedSubprotocols = parseSubprotocolHeader(
      request.headers['sec-websocket-protocol'],
    );
    const protocolVersion = detectProtocolVersion(requestedSubprotocols);
    if (!protocolVersion) {
      rejectUpgrade(
        socket,
        400,
        'Unrecognized or missing Sec-WebSocket-Protocol',
      );
      return;
    }

    const basicAuth = OcppAuthenticationService.parseBasicAuthHeader(
      request.headers.authorization,
    );
    if (!basicAuth) {
      rejectUpgrade(socket, 401, 'Missing or malformed Authorization header');
      return;
    }
    if (basicAuth.identity !== ocppIdentity) {
      rejectUpgrade(
        socket,
        401,
        'Basic Auth identity does not match the connection path',
      );
      return;
    }

    const authResult = await this.authentication.authenticate(
      ocppIdentity,
      basicAuth.secret,
    );
    if (!authResult.ok) {
      rejectUpgrade(socket, 401, 'Invalid credentials');
      return;
    }

    const station = authResult.station;
    const adapter = this.adapterFor(protocolVersion);

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.onConnectionEstablished(ws, station, adapter, protocolVersion);
    });
  }

  private adapterFor(version: OcppProtocolVersion): ProtocolAdapter {
    return version === 'OCPP1_6J' ? this.ocpp16Adapter : this.ocpp201Adapter;
  }

  private onConnectionEstablished(
    ws: WebSocket,
    station: ChargingStation,
    adapter: ProtocolAdapter,
    protocolVersion: OcppProtocolVersion,
  ): void {
    const ocppIdentity = station.ocppIdentity as string;

    this.connectionRegistry.register({
      ocppIdentity,
      chargingStationId: station.id,
      protocolVersion,
      socket: ws,
    });
    this.logger.log(
      `OCPP connection established: ${ocppIdentity} (${protocolVersion})`,
    );

    ws.on('message', (data: Buffer) => {
      void this.handleMessage(ws, station, adapter, data);
    });

    ws.on('close', () => {
      this.connectionRegistry.unregister(ocppIdentity, ws);
      this.logger.log(`OCPP connection closed: ${ocppIdentity}`);
    });

    ws.on('error', (error: Error) => {
      this.logger.warn(
        `OCPP WebSocket error for ${ocppIdentity}: ${error.message}`,
      );
    });
  }

  private async handleMessage(
    ws: WebSocket,
    station: ChargingStation,
    adapter: ProtocolAdapter,
    data: Buffer,
  ): Promise<void> {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      // Not parseable as JSON at all — no messageId is extractable, so
      // there's nothing protocol-correct to respond with. The router's
      // malformed-frame path still logs the attempt.
      await this.router.handleInboundFrame(adapter, station, { raw: null });
      return;
    }

    const response = await this.router.handleInboundFrame(adapter, station, {
      raw,
    });
    if (response) {
      ws.send(JSON.stringify(response.raw));
    }
  }
}

function parseSubprotocolHeader(
  header: string | string[] | undefined,
): string[] {
  if (!header) return [];
  const value = Array.isArray(header) ? header.join(',') : header;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function rejectUpgrade(
  socket: Duplex,
  statusCode: number,
  message: string,
): void {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\n\r\n`);
  socket.destroy();
}
