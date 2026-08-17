import {
  computeEvseOperationalStatus,
  type ConnectorEvidence,
} from './evse-operational-status';

function connector(
  status: ConnectorEvidence['status'],
  hasActiveSession = false,
): ConnectorEvidence {
  return { status, hasActiveSession };
}

describe('computeEvseOperationalStatus (WO-ARGOS-056)', () => {
  it('ONLINE + 2 AVAILABLE -> AVAILABLE', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('AVAILABLE'), connector('AVAILABLE')],
    });
    expect(result.operationalStatus).toBe('AVAILABLE');
    expect(result.requiresAttention).toBe(false);
    expect(result.connectorSummary).toEqual({
      total: 2,
      available: 2,
      inUse: 0,
      unavailable: 0,
      faulted: 0,
    });
  });

  it('ONLINE + AVAILABLE + CHARGING -> PARTIALLY_AVAILABLE', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('AVAILABLE'), connector('CHARGING')],
    });
    expect(result.operationalStatus).toBe('PARTIALLY_AVAILABLE');
    expect(result.requiresAttention).toBe(false);
  });

  it('ONLINE + 2 CHARGING -> IN_USE', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('CHARGING'), connector('CHARGING')],
    });
    expect(result.operationalStatus).toBe('IN_USE');
    expect(result.requiresAttention).toBe(false);
  });

  it('ONLINE + AVAILABLE + FAULTED -> PARTIALLY_AVAILABLE + requiresAttention', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('AVAILABLE'), connector('FAULTED')],
    });
    expect(result.operationalStatus).toBe('PARTIALLY_AVAILABLE');
    expect(result.requiresAttention).toBe(true);
    expect(result.attentionReasons).toEqual(['CONNECTOR_FAULTED']);
    expect(result.connectorSummary.faulted).toBe(1);
  });

  it('ONLINE + 2 UNAVAILABLE -> UNAVAILABLE', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('UNAVAILABLE'), connector('UNAVAILABLE')],
    });
    expect(result.operationalStatus).toBe('UNAVAILABLE');
    expect(result.requiresAttention).toBe(false);
  });

  it('OFFLINE + connectors previously AVAILABLE -> OFFLINE, never presented as current availability', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'OFFLINE',
      connectors: [connector('AVAILABLE'), connector('UNAVAILABLE')],
    });
    expect(result.operationalStatus).toBe('OFFLINE');
    expect(result.requiresAttention).toBe(false);
    // The raw evidence is still summarized (for last-known-state framing by
    // the caller), but the top-line status is OFFLINE regardless.
    expect(result.connectorSummary.available).toBe(1);
  });

  it('UNKNOWN connectivity -> UNKNOWN', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'UNKNOWN',
      connectors: [connector('AVAILABLE')],
    });
    expect(result.operationalStatus).toBe('UNKNOWN');
  });

  it('ACTIVE session + Connector AVAILABLE -> IN_USE + requiresAttention (ACTIVE_SESSION_CONNECTOR_NOT_IN_USE)', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('AVAILABLE', true)],
    });
    expect(result.operationalStatus).toBe('IN_USE');
    expect(result.requiresAttention).toBe(true);
    expect(result.attentionReasons).toEqual([
      'ACTIVE_SESSION_CONNECTOR_NOT_IN_USE',
    ]);
  });

  it('EVSE with no connectors -> UNKNOWN', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [],
    });
    expect(result.operationalStatus).toBe('UNKNOWN');
  });

  it('single connector AVAILABLE -> AVAILABLE', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('AVAILABLE')],
    });
    expect(result.operationalStatus).toBe('AVAILABLE');
  });

  it('single connector CHARGING -> IN_USE', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('CHARGING')],
    });
    expect(result.operationalStatus).toBe('IN_USE');
  });

  // Digital Twin validation scenario (WO-ARGOS-056): AVAILABLE + plain
  // UNAVAILABLE (no fault, no charging) must stay AVAILABLE, not degrade to
  // PARTIALLY_AVAILABLE — reconciling this against the FAULTED case above is
  // exactly the rule documented in evse-operational-status.ts.
  it('ONLINE + AVAILABLE + plain UNAVAILABLE -> AVAILABLE (Digital Twin scenario)', () => {
    const result = computeEvseOperationalStatus({
      connectivityStatus: 'ONLINE',
      connectors: [connector('AVAILABLE'), connector('UNAVAILABLE')],
    });
    expect(result.operationalStatus).toBe('AVAILABLE');
    expect(result.requiresAttention).toBe(false);
    expect(result.connectorSummary).toEqual({
      total: 2,
      available: 1,
      inUse: 0,
      unavailable: 1,
      faulted: 0,
    });
  });
});
