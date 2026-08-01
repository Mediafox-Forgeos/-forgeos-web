import { Test } from '@nestjs/testing';

import { TransactionUpdateHandler } from './transaction-update.handler';
import { MeterValuesService } from '../../sessions/meter-values.service';
import { PrismaService } from '../../prisma/prisma.service';

const station = { id: 'cs1' } as import('@prisma/client').ChargingStation;

describe('TransactionUpdateHandler', () => {
  let handler: TransactionUpdateHandler;
  let prisma: { chargingSession: { findFirst: jest.Mock } };
  let meterValues: { record: jest.Mock };

  beforeEach(async () => {
    prisma = { chargingSession: { findFirst: jest.fn() } };
    meterValues = { record: jest.fn().mockResolvedValue({ id: 'mv-1' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionUpdateHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: MeterValuesService, useValue: meterValues },
      ],
    }).compile();

    handler = moduleRef.get(TransactionUpdateHandler);
  });

  it('records a MeterValue when the transaction resolves to a known session', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue({ id: 'session-1' });

    const result = await handler.handle(
      {
        type: 'TransactionUpdate',
        stationIdentity: 'movos-abc123',
        transactionRef: '42',
        values: [
          {
            measurand: 'Energy.Active.Import.Register',
            value: 1500,
            unit: 'Wh',
          },
        ],
        timestamp: '2026-07-31T00:05:00.000Z',
      },
      station,
    );

    expect(meterValues.record).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', energyWh: 1500 }),
    );
    expect(result).toEqual({ status: 'Accepted' });
  });

  it('rejects gracefully (no crash, no MeterValue) when the transactionRef matches no session', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue(null);

    const result = await handler.handle(
      {
        type: 'TransactionUpdate',
        stationIdentity: 'movos-abc123',
        transactionRef: '999999',
        values: [
          {
            measurand: 'Energy.Active.Import.Register',
            value: 1500,
            unit: 'Wh',
          },
        ],
        timestamp: '2026-07-31T00:05:00.000Z',
      },
      station,
    );

    expect(meterValues.record).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'Rejected' });
  });

  it('accepts as a no-op when no Energy.Active.Import.Register sample is present — missing telemetry', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue({ id: 'session-1' });

    const result = await handler.handle(
      {
        type: 'TransactionUpdate',
        stationIdentity: 'movos-abc123',
        transactionRef: '42',
        values: [{ measurand: 'Voltage', value: 230 }],
        timestamp: '2026-07-31T00:05:00.000Z',
      },
      station,
    );

    expect(meterValues.record).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'Accepted' });
  });

  it('converts a kWh-unit sample to Wh before recording', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue({ id: 'session-1' });

    await handler.handle(
      {
        type: 'TransactionUpdate',
        stationIdentity: 'movos-abc123',
        transactionRef: '42',
        values: [
          {
            measurand: 'Energy.Active.Import.Register',
            value: 1.5,
            unit: 'kWh',
          },
        ],
        timestamp: '2026-07-31T00:05:00.000Z',
      },
      station,
    );

    expect(meterValues.record).toHaveBeenCalledWith(
      expect.objectContaining({ energyWh: 1500 }),
    );
  });
});
