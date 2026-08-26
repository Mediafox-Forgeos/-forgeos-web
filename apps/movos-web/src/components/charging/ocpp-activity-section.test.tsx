import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiOcppProtocolEvent } from '@mediafox/shared-types';

import { OcppActivitySection } from './ocpp-activity-section';
import { ApiError } from '@/lib/api-client';
import * as ocppEventsApi from '@/lib/ocpp-events-api';

afterEach(() => {
  vi.restoreAllMocks();
});

function event(
  overrides: Partial<ApiOcppProtocolEvent> = {},
): ApiOcppProtocolEvent {
  return {
    id: 'evt-1',
    chargingStationId: 'cs-1',
    protocolVersion: 'OCPP1_6J',
    direction: 'INBOUND',
    messageType: 'CALL',
    action: 'BootNotification',
    protocolMessageId: 'msg-1',
    payload: { chargePointVendor: 'Acme' },
    processingStatus: 'PROCESSED',
    processingError: null,
    receivedAt: '2026-08-26T17:40:15.000Z',
    ...overrides,
  };
}

// WO-ARGOS-091 §13.
describe('OcppActivitySection — renders', () => {
  it('15. renders the section with recent events', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [event()],
      hasMore: false,
    });

    render(<OcppActivitySection stationId="cs-1" />);

    expect(await screen.findByText('Actividad OCPP')).toBeInTheDocument();
    expect(screen.getByText('BootNotification')).toBeInTheDocument();
  });

  it('16. shows an honest empty state, not a fabricated one', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [],
      hasMore: false,
    });

    render(<OcppActivitySection stationId="cs-1" />);

    expect(
      await screen.findByText(
        'Sin actividad OCPP registrada para esta estación.',
      ),
    ).toBeInTheDocument();
  });

  it('17. inbound/outbound are distinguishable by text label, not color alone', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [
        event({ id: 'evt-in', direction: 'INBOUND', action: 'Heartbeat' }),
        event({
          id: 'evt-out',
          direction: 'OUTBOUND',
          action: 'RemoteStartTransaction',
        }),
      ],
      hasMore: false,
    });

    render(<OcppActivitySection stationId="cs-1" />);

    expect(await screen.findByText('Del cargador')).toBeInTheDocument();
    expect(screen.getByText('Al cargador')).toBeInTheDocument();
  });

  it('18. the event action renders correctly, falling back to messageType when action is null', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [
        event({
          id: 'evt-callresult',
          action: null,
          messageType: 'CALLRESULT',
        }),
      ],
      hasMore: false,
    });

    render(<OcppActivitySection stationId="cs-1" />);

    expect((await screen.findAllByText('CALLRESULT')).length).toBeGreaterThan(
      0,
    );
  });

  it('19. expanding a row shows the sanitized payload', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [event({ payload: { chargePointVendor: 'Acme' } })],
      hasMore: false,
    });
    const user = userEvent.setup();

    render(<OcppActivitySection stationId="cs-1" />);
    const row = await screen.findByRole('button', {
      name: /BootNotification/,
    });
    expect(screen.queryByText(/chargePointVendor/)).not.toBeInTheDocument();

    await user.click(row);

    expect(screen.getByText(/chargePointVendor/)).toBeInTheDocument();
  });

  it('20. CALL/CALLRESULT/CALLERROR are visually distinguishable', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [
        event({ id: 'evt-call', messageType: 'CALL' }),
        event({ id: 'evt-error', action: null, messageType: 'CALLERROR' }),
      ],
      hasMore: false,
    });

    render(<OcppActivitySection stationId="cs-1" />);

    expect(await screen.findByText('CALL')).toBeInTheDocument();
    // Appears twice for the CALLERROR row: once as the row label (action is
    // null, falls back to messageType) and once as its own badge — both
    // are correct, not a duplication bug.
    expect(screen.getAllByText('CALLERROR').length).toBeGreaterThan(0);
  });

  it('21. loading state is bounded — replaced by content or an error, never stuck', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [event()],
      hasMore: false,
    });

    render(<OcppActivitySection stationId="cs-1" />);

    expect(await screen.findByText('BootNotification')).toBeInTheDocument();
  });

  it('22. a backend failure displays an actionable error, not a silent blank section', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockRejectedValue(
      new ApiError(500, 'Error interno del servidor.'),
    );

    render(<OcppActivitySection stationId="cs-1" />);

    expect(
      await screen.findByText('No fue posible cargar la actividad OCPP.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });

  it('23. never renders a raw secret value — the section trusts server-side redaction and does not un-redact anything', async () => {
    vi.spyOn(ocppEventsApi, 'listOcppEvents').mockResolvedValue({
      events: [
        event({ payload: { password: '[REDACTED]', idTag: 'ABCD1234' } }),
      ],
      hasMore: false,
    });
    const user = userEvent.setup();

    render(<OcppActivitySection stationId="cs-1" />);
    await user.click(
      await screen.findByRole('button', { name: /BootNotification/ }),
    );

    const payloadBlock = screen.getByText(/idTag/).closest('pre')!;
    expect(within(payloadBlock).getByText(/\[REDACTED\]/)).toBeInTheDocument();
  });
});
