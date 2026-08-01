import { Test } from '@nestjs/testing';

import { MeterValuesService } from './meter-values.service';
import { SessionLifecycleService } from './session-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  chargingSession: { findUnique: jest.Mock };
  meterValue: { create: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingSession: { findUnique: jest.fn() },
    meterValue: { create: jest.fn() },
  };
}

describe('MeterValuesService', () => {
  let service: MeterValuesService;
  let prisma: PrismaMock;
  let sessionLifecycle: { updateEnergy: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    sessionLifecycle = { updateEnergy: jest.fn().mockResolvedValue(undefined) };
    prisma.meterValue.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'mv-1', ...data }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        MeterValuesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionLifecycleService, useValue: sessionLifecycle },
      ],
    }).compile();

    service = moduleRef.get(MeterValuesService);
  });

  it('records a sample and advances the session energyWh when it increases', async () => {
    prisma.chargingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      energyWh: 500,
    });

    const result = await service.record({
      sessionId: 'session-1',
      timestamp: new Date(),
      energyWh: 800,
    });

    expect(result).not.toBeNull();
    expect(prisma.meterValue.create).toHaveBeenCalledTimes(1);
    expect(sessionLifecycle.updateEnergy).toHaveBeenCalledWith(
      'session-1',
      800,
    );
  });

  it('drops a non-monotonic sample (energyWh decreased) and leaves the session unaffected', async () => {
    prisma.chargingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      energyWh: 900,
    });

    const result = await service.record({
      sessionId: 'session-1',
      timestamp: new Date(),
      energyWh: 500,
    });

    expect(result).toBeNull();
    expect(prisma.meterValue.create).not.toHaveBeenCalled();
    expect(sessionLifecycle.updateEnergy).not.toHaveBeenCalled();
  });

  it('records a sample equal to the current energyWh without re-touching the session', async () => {
    prisma.chargingSession.findUnique.mockResolvedValue({
      id: 'session-1',
      energyWh: 700,
    });

    const result = await service.record({
      sessionId: 'session-1',
      timestamp: new Date(),
      energyWh: 700,
    });

    expect(result).not.toBeNull();
    expect(prisma.meterValue.create).toHaveBeenCalledTimes(1);
    expect(sessionLifecycle.updateEnergy).not.toHaveBeenCalled();
  });

  it('drops telemetry for an unknown session without throwing — telemetry loss must never invalidate a session', async () => {
    prisma.chargingSession.findUnique.mockResolvedValue(null);

    const result = await service.record({
      sessionId: 'missing-session',
      timestamp: new Date(),
      energyWh: 100,
    });

    expect(result).toBeNull();
    expect(prisma.meterValue.create).not.toHaveBeenCalled();
  });
});
