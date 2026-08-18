import { describe, expect, it } from 'vitest';
import type {
  ApiEvseListItem,
  ApiOfflineStation,
  ApiWorkOrderAttentionItem,
} from '@mediafox/shared-types';

import { attentionGroupRank, buildAttentionGroups } from './unified-attention';

function evse(overrides: Partial<ApiEvseListItem> = {}): ApiEvseListItem {
  return {
    id: 'evse-1',
    chargingStationId: 'station-1',
    chargingStationName: 'Estación 1',
    siteId: 'site-1',
    siteName: 'Sitio 1',
    externalId: '1',
    name: null,
    status: 'AVAILABLE',
    maxPowerKw: 60,
    currentType: 'DC',
    phaseType: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    operationalStatus: 'PARTIALLY_AVAILABLE',
    requiresAttention: true,
    attentionReasons: ['CONNECTOR_FAULTED'],
    connectorSummary: {
      total: 2,
      available: 1,
      inUse: 0,
      unavailable: 0,
      faulted: 1,
    },
    ...overrides,
  };
}

function offlineStation(
  overrides: Partial<ApiOfflineStation> = {},
): ApiOfflineStation {
  return {
    stationId: 'station-1',
    stationName: 'Estación 1',
    siteId: 'site-1',
    siteName: 'Sitio 1',
    lastDisconnectedAt: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

function workOrderItem(
  overrides: Partial<ApiWorkOrderAttentionItem['workOrder']> = {},
  reasons: ApiWorkOrderAttentionItem['reasons'] = ['UNASSIGNED'],
): ApiWorkOrderAttentionItem {
  return {
    workOrder: {
      id: 'wo-1',
      title: 'Revisar estación',
      description: '',
      status: 'OPEN',
      priority: 'MEDIUM',
      source: 'MANUAL',
      stationId: 'station-1',
      stationName: 'Estación 1',
      assignedMemberId: null,
      assignedMemberName: null,
      assignedAt: null,
      startedAt: null,
      scheduledAt: null,
      resolvedAt: null,
      notes: null,
      createdAt: '2026-08-17T00:00:00.000Z',
      updatedAt: '2026-08-17T00:00:00.000Z',
      visitLocation: {
        siteName: 'Sitio 1',
        stationName: 'Estación 1',
        formattedAddress: null,
        latitude: null,
        longitude: null,
      },
      ...overrides,
    },
    reasons,
  };
}

describe('buildAttentionGroups — deduplication (WO-ARGOS-057)', () => {
  it('merges an offline station and its WorkOrder into ONE group, not two', () => {
    const groups = buildAttentionGroups(
      [],
      [workOrderItem()],
      [offlineStation()],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].stationId).toBe('station-1');
    // Both pieces of evidence are preserved inside the single group — the
    // WorkOrder does not erase the underlying offline condition.
    expect(groups[0].offline).not.toBeNull();
    expect(groups[0].workOrders).toHaveLength(1);
  });

  it('merges an EVSE-level attention item into the same group as its station offline entry', () => {
    const groups = buildAttentionGroups(
      [evse({ chargingStationId: 'station-1' })],
      [],
      [offlineStation({ stationId: 'station-1' })],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].evseIssues).toHaveLength(1);
    expect(groups[0].offline).not.toBeNull();
  });

  it('keeps unrelated stations as separate groups', () => {
    const groups = buildAttentionGroups(
      [],
      [],
      [
        offlineStation({ stationId: 'station-1' }),
        offlineStation({ stationId: 'station-2', stationName: 'Estación 2' }),
      ],
    );

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.stationId).sort()).toEqual([
      'station-1',
      'station-2',
    ]);
  });

  it('ignores EVSEs whose requiresAttention is false', () => {
    const groups = buildAttentionGroups(
      [evse({ requiresAttention: false, attentionReasons: [] })],
      [],
      [],
    );
    expect(groups).toHaveLength(0);
  });

  it('a WorkOrder unrelated to any infrastructure problem still gets its own group (not hidden)', () => {
    const groups = buildAttentionGroups(
      [],
      [
        workOrderItem({
          stationId: 'healthy-station',
          stationName: 'Estación sana',
        }),
      ],
      [],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].offline).toBeNull();
    expect(groups[0].evseIssues).toHaveLength(0);
    expect(groups[0].workOrders).toHaveLength(1);
  });

  it('fills in siteId/siteName from whichever source carries them (WorkOrder carries neither)', () => {
    const groups = buildAttentionGroups(
      [],
      [workOrderItem()],
      [offlineStation({ siteId: 'site-9', siteName: 'Sitio 9' })],
    );
    expect(groups[0].siteId).toBe('site-9');
    expect(groups[0].siteName).toBe('Sitio 9');
  });

  it('leaves siteId null for a group built only from a WorkOrder item (no site data available)', () => {
    const groups = buildAttentionGroups([], [workOrderItem()], []);
    expect(groups[0].siteId).toBeNull();
  });
});

describe('attentionGroupRank — operational impact, not scary labels (WO-ARGOS-057)', () => {
  it('ranks a fully OFFLINE station above a FAULTED-connector station, regardless of connector count', () => {
    const offlineGroup = buildAttentionGroups(
      [],
      [],
      [offlineStation({ stationId: 'small-offline-station' })],
    )[0];
    const faultedGroup = buildAttentionGroups(
      [
        evse({
          chargingStationId: 'big-station-one-fault',
          attentionReasons: ['CONNECTOR_FAULTED'],
        }),
      ],
      [],
      [],
    )[0];

    expect(attentionGroupRank(offlineGroup)).toBeLessThan(
      attentionGroupRank(faultedGroup),
    );
  });

  it('sorts groups by rank, offline first', () => {
    const groups = buildAttentionGroups(
      [evse({ chargingStationId: 'faulted-station' })],
      [workOrderItem({ stationId: 'unassigned-wo-station' }, ['UNASSIGNED'])],
      [offlineStation({ stationId: 'offline-station' })],
    );
    expect(groups.map((g) => g.stationId)).toEqual([
      'offline-station',
      'faulted-station',
      'unassigned-wo-station',
    ]);
  });

  it('a session/status-mismatch EVSE issue (no FAULTED) ranks below a FAULTED one', () => {
    const mismatchGroup = buildAttentionGroups(
      [
        evse({
          chargingStationId: 'mismatch-station',
          attentionReasons: ['ACTIVE_SESSION_CONNECTOR_NOT_IN_USE'],
        }),
      ],
      [],
      [],
    )[0];
    const faultedGroup = buildAttentionGroups(
      [
        evse({
          chargingStationId: 'faulted-station',
          attentionReasons: ['CONNECTOR_FAULTED'],
        }),
      ],
      [],
      [],
    )[0];
    expect(attentionGroupRank(faultedGroup)).toBeLessThan(
      attentionGroupRank(mismatchGroup),
    );
  });
});
