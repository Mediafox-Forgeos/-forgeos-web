import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Test } from '@nestjs/testing';
import WebSocket from 'ws';
import type { ChargingStation } from '@prisma/client';

import { OcppWebSocketServer } from './ocpp-websocket.server';
import { OcppAuthenticationService } from '../authentication/ocpp-authentication.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { OcppMessageRouterService } from '../routing/ocpp-message-router.service';
import { Ocpp16Adapter } from '../protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from '../protocol/ocpp201/ocpp201-adapter';

/**
 * Integration coverage for the transport class itself: a real Node HTTP
 * server, a real `ws` client, and a real upgrade handshake — only
 * authentication and message routing are stubbed (as in every other OCPP
 * spec in this suite), since those already have their own dedicated unit
 * coverage. This is the one spec in the OCPP suite that opens a real TCP
 * socket; everything else is a plain Jest unit test. It is still not a
 * true end-to-end test — for that, see the WO-ARGOS-008 manual runtime
 * validation record in docs/engineering/OCPP_ENGINE_GUIDE.md, which ran
 * this same transport against a real PostgreSQL-backed movos-api instance.
 */
describe('OcppWebSocketServer (real HTTP + real WebSocket, mocked auth/router)', () => {
  const station = {
    id: 'cs1',
    ocppIdentity: 'movos-abc123',
  } as ChargingStation;

  let httpServer: HttpServer;
  let port: number;
  let authentication: { authenticate: jest.Mock };
  let router: { handleInboundFrame: jest.Mock };
  let connectionRegistry: ConnectionRegistryService;
  const clients: WebSocket[] = [];

  beforeEach(async () => {
    authentication = {
      authenticate: jest.fn().mockResolvedValue({ ok: true, station }),
    };
    router = {
      handleInboundFrame: jest.fn().mockResolvedValue(null),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppWebSocketServer,
        ConnectionRegistryService,
        Ocpp16Adapter,
        Ocpp201Adapter,
        { provide: OcppAuthenticationService, useValue: authentication },
        { provide: OcppMessageRouterService, useValue: router },
      ],
    }).compile();

    connectionRegistry = moduleRef.get(ConnectionRegistryService);
    const transport = moduleRef.get(OcppWebSocketServer);

    httpServer = createServer();
    transport.attach(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', resolve);
    });
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.removeAllListeners();
      if (client.readyState === WebSocket.OPEN) client.terminate();
    }
    connectionRegistry.onModuleDestroy();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connectClient(options: {
    identity?: string;
    secret?: string;
    protocol?: string;
    omitAuth?: boolean;
  }): WebSocket {
    const identity = options.identity ?? station.ocppIdentity;
    const authHeader = options.omitAuth
      ? undefined
      : `Basic ${Buffer.from(`${identity}:${options.secret ?? 'secret123'}`).toString('base64')}`;

    const client = new WebSocket(
      `ws://127.0.0.1:${port}/ocpp/${identity}`,
      [options.protocol ?? 'ocpp1.6'],
      authHeader ? { headers: { Authorization: authHeader } } : undefined,
    );
    clients.push(client);
    return client;
  }

  function waitForOpen(client: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      client.once('open', () => resolve());
      client.once('unexpected-response', (_req, res) =>
        reject(new Error(`HTTP ${res.statusCode}`)),
      );
      client.once('error', reject);
    });
  }

  function waitForClose(
    client: WebSocket,
  ): Promise<{ code: number; reason: string }> {
    return new Promise((resolve) => {
      client.once('close', (code, reason) =>
        resolve({ code, reason: reason.toString() }),
      );
    });
  }

  it('completes a successful WebSocket upgrade end-to-end', async () => {
    const client = connectClient({});
    await waitForOpen(client);

    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(connectionRegistry.isConnected(station.ocppIdentity as string)).toBe(
      true,
    );
  });

  it('negotiates the requested OCPP subprotocol', async () => {
    const client16 = connectClient({ protocol: 'ocpp1.6' });
    await waitForOpen(client16);
    expect(client16.protocol).toBe('ocpp1.6');
    client16.close();

    const client201 = connectClient({
      identity: 'movos-abc123',
      protocol: 'ocpp2.0.1',
    });
    await waitForOpen(client201);
    expect(client201.protocol).toBe('ocpp2.0.1');
  });

  it('hands the decoded Basic Auth identity and secret to the authentication service', async () => {
    const client = connectClient({ secret: 'my-real-secret' });
    await waitForOpen(client);

    expect(authentication.authenticate).toHaveBeenCalledWith(
      station.ocppIdentity,
      'my-real-secret',
    );
  });

  it('rejects the upgrade when authentication fails, and registers no connection', async () => {
    authentication.authenticate.mockResolvedValue({
      ok: false,
      reason: 'invalid_credentials',
    });

    const client = connectClient({ secret: 'wrong' });
    await expect(waitForOpen(client)).rejects.toThrow('HTTP 401');
    expect(connectionRegistry.isConnected(station.ocppIdentity as string)).toBe(
      false,
    );
  });

  it('rejects the upgrade when the Authorization header is missing entirely', async () => {
    const client = connectClient({ omitAuth: true });
    await expect(waitForOpen(client)).rejects.toThrow('HTTP 401');
    expect(authentication.authenticate).not.toHaveBeenCalled();
  });

  it('delivers an inbound message to the router and writes its response back over the same socket', async () => {
    router.handleInboundFrame.mockResolvedValue({
      raw: [3, 'msg-1', { status: 'Accepted' }],
    });

    const client = connectClient({});
    await waitForOpen(client);

    const responsePromise = new Promise<string>((resolve) => {
      client.once('message', (data) => resolve(data.toString()));
    });
    client.send(JSON.stringify([2, 'msg-1', 'Heartbeat', {}]));

    const responseRaw = await responsePromise;
    expect(JSON.parse(responseRaw)).toEqual([
      3,
      'msg-1',
      { status: 'Accepted' },
    ]);

    const [, passedStation, passedFrame] = router.handleInboundFrame.mock
      .calls[0] as [unknown, ChargingStation, { raw: unknown }];
    expect(passedStation.ocppIdentity).toBe(station.ocppIdentity);
    expect(passedFrame.raw).toEqual([2, 'msg-1', 'Heartbeat', {}]);
  });

  it('routes a non-JSON frame to the router as {raw: null} and keeps the connection alive', async () => {
    const client = connectClient({});
    await waitForOpen(client);

    client.send('this is not valid OCPP-J at all {{{');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(router.handleInboundFrame).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ocppIdentity: station.ocppIdentity }),
      { raw: null },
    );
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it('replaces the previous connection when a second client connects with the same identity', async () => {
    const first = connectClient({});
    await waitForOpen(first);
    expect(connectionRegistry.listConnected()).toHaveLength(1);

    const firstClosed = waitForClose(first);
    const second = connectClient({});
    await waitForOpen(second);

    const closeInfo = await firstClosed;
    expect(closeInfo.code).toBe(1000);
    expect(closeInfo.reason).toBe('replaced-by-new-connection');
    expect(connectionRegistry.listConnected()).toHaveLength(1);
    expect(second.readyState).toBe(WebSocket.OPEN);
  });

  it('unregisters the connection on a clean client-initiated close', async () => {
    const client = connectClient({});
    await waitForOpen(client);
    expect(connectionRegistry.isConnected(station.ocppIdentity as string)).toBe(
      true,
    );

    client.close(1000, 'client-done');
    await waitForClose(client);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(connectionRegistry.isConnected(station.ocppIdentity as string)).toBe(
      false,
    );
  });

  it('keeps the HTTP server accepting new connections after an abrupt client-side termination', async () => {
    const client = connectClient({});
    await waitForOpen(client);

    client.terminate(); // abrupt teardown — no close handshake
    await new Promise((resolve) => setTimeout(resolve, 100));

    const second = connectClient({});
    await waitForOpen(second);
    expect(second.readyState).toBe(WebSocket.OPEN);
  });
});
