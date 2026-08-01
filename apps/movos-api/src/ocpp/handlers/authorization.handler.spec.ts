import { Test } from '@nestjs/testing';

import { AuthorizationHandler } from './authorization.handler';
import { AuthorizationAttemptsService } from '../../authorization/authorization-attempts.service';
import { PrismaService } from '../../prisma/prisma.service';

const station = {
  id: 'cs1',
  siteId: 'site-1',
} as import('@prisma/client').ChargingStation;

describe('AuthorizationHandler', () => {
  let handler: AuthorizationHandler;
  let prisma: { site: { findUniqueOrThrow: jest.Mock } };
  let attempts: { recordAttempt: jest.Mock };

  beforeEach(async () => {
    prisma = {
      site: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ organizationId: 'org-1' }),
      },
    };
    attempts = { recordAttempt: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthorizationHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthorizationAttemptsService, useValue: attempts },
      ],
    }).compile();

    handler = moduleRef.get(AuthorizationHandler);
  });

  it('accepts a valid credential and reports idTagStatus Accepted', async () => {
    attempts.recordAttempt.mockResolvedValue({
      attempt: { result: 'ACCEPTED' },
      credential: { id: 'cred-1' },
    });

    const result = await handler.handle(
      {
        type: 'Authorization',
        stationIdentity: 'movos-abc123',
        idTag: 'ABC123',
      },
      station,
    );

    expect(result).toEqual({
      status: 'Accepted',
      payload: { idTagStatus: 'Accepted' },
    });
  });

  it('rejects an unknown idTag and reports idTagStatus Invalid, recording the attempt regardless', async () => {
    attempts.recordAttempt.mockResolvedValue({
      attempt: { result: 'UNKNOWN' },
      credential: null,
    });

    const result = await handler.handle(
      { type: 'Authorization', stationIdentity: 'movos-abc123', idTag: 'NOPE' },
      station,
    );

    expect(result).toEqual({
      status: 'Rejected',
      payload: { idTagStatus: 'Invalid' },
    });
    expect(attempts.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        chargingStationId: 'cs1',
        presentedIdentifier: 'NOPE',
      }),
    );
  });

  // DEC-014 ("authorization alone never creates a session") is enforced by
  // construction, not by a runtime check: AuthorizationHandler's
  // constructor above takes only PrismaService and
  // AuthorizationAttemptsService — it has no SessionLifecycleService
  // dependency at all, so there is no code path by which handling an
  // Authorization event could create a ChargingSession.
});
