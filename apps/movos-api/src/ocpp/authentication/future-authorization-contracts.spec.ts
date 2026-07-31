import type {
  AuthorizationAttempt,
  AuthorizationCredential,
  AuthorizationDecision,
} from './future-authorization-contracts';

/**
 * Test 21: Future RFID and authorization contracts compile without
 * requiring implementation. This spec's real assertion is that the file
 * compiles at all — if a future edit breaks these types' internal
 * consistency, `tsc`/`ts-jest` fails before a single `expect()` runs. The
 * runtime assertions below just prove the shapes are actually usable, not
 * merely syntactically valid.
 */
describe('future authorization contracts', () => {
  it('a valid AuthorizationCredential literal satisfies the type', () => {
    const credential: AuthorizationCredential = {
      id: 'cred_1',
      type: 'RFID',
      externalIdentifier: '04A2B3C4',
      status: 'ACTIVE',
      validFrom: '2026-01-01T00:00:00.000Z',
    };
    expect(credential.type).toBe('RFID');
    expect(credential.externalIdentifier).not.toBe(credential.id);
  });

  it('a valid AuthorizationAttempt/AuthorizationDecision pair satisfies the types', () => {
    const attempt: AuthorizationAttempt = {
      id: 'attempt_1',
      credentialId: 'cred_1',
      stationIdentity: 'movos-abc123',
      connectorExternalId: '1',
      attemptedAt: '2026-07-30T00:00:00.000Z',
    };
    const decision: AuthorizationDecision = {
      id: 'decision_1',
      attemptId: attempt.id,
      outcome: 'ACCEPTED',
    };
    expect(decision.attemptId).toBe(attempt.id);
  });

  it('every credential type named in the Authorization Architecture doc is representable', () => {
    const types: AuthorizationCredential['type'][] = [
      'RFID',
      'QR',
      'App',
      'Remote',
      'API',
      'Fleet',
      'PlugAndCharge',
      'Guest',
      'LocalList',
    ];
    expect(types).toHaveLength(9);
  });
});
