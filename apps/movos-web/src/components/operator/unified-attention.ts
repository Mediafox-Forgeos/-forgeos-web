import type {
  ApiAttentionReason,
  ApiEvseListItem,
  ApiOfflineStation,
  ApiWorkOrderAttentionItem,
} from '@mediafox/shared-types';

/**
 * WO-ARGOS-057 — Unified Attention V1. Merges three independent, real
 * systems client-side, over their existing endpoints (no new backend
 * endpoint):
 *   1. WO-056 EVSE-level `requiresAttention`/`attentionReasons` (GET /evses)
 *   2. WO-051 WorkOrder attention rules (GET /work-orders/attention)
 *   3. Connectivity-verified offline stations (GET /operator/offline-stations)
 *
 * Dedup key: ChargingStation id. The same real-world problem (e.g. a
 * disconnected station with a resulting WorkOrder) must count once toward
 * the total, not once per detecting system — observed live this session
 * (the same Digital Twin disconnection showed as 2 separate "Requiere
 * atención" items). But entity granularity is preserved INSIDE each group
 * (offline/evseIssues/workOrders are kept separately, never flattened into
 * one item) — a WorkOrder about an infrastructure problem must not erase
 * the underlying condition it's about; the UI shows the relationship
 * instead of hiding one side of it.
 */

export interface AttentionEvseIssue {
  evseId: string;
  evseName: string;
  reasons: ApiAttentionReason[];
}

export interface AttentionGroup {
  stationId: string;
  stationName: string;
  /** Known only when an offline-station or EVSE-attention source
   * contributed to this group — ApiWorkOrder carries no siteId, so a group
   * built purely from a WorkOrder attention item has siteId: null. Callers
   * must not build a station-detail link without checking this first. */
  siteId: string | null;
  siteName: string | null;
  offline: ApiOfflineStation | null;
  evseIssues: AttentionEvseIssue[];
  workOrders: ApiWorkOrderAttentionItem[];
}

const P0_WORK_ORDER_REASONS = new Set([
  'HIGH_PRIORITY_UNRESOLVED',
  'STALLED_IN_PROGRESS',
]);

/**
 * Priority rank, lowest = most urgent. Ordered by real operational impact,
 * not by which status label sounds scariest (ARGOS's explicit product
 * decision on WO-ARGOS-057): a fully OFFLINE station always outranks a
 * single FAULTED connector, because it blocks 100% of that station's
 * capacity right now regardless of how "severe" FAULTED sounds on its own.
 */
export function attentionGroupRank(group: AttentionGroup): 0 | 1 | 2 | 3 {
  if (group.offline) return 0;
  if (
    group.evseIssues.some((issue) =>
      issue.reasons.includes('CONNECTOR_FAULTED'),
    )
  ) {
    return 1;
  }
  if (
    group.workOrders.some((item) =>
      item.reasons.some((reason) => P0_WORK_ORDER_REASONS.has(reason)),
    )
  ) {
    return 1;
  }
  if (group.evseIssues.length > 0 || group.workOrders.length > 0) return 2;
  return 3;
}

export function buildAttentionGroups(
  evses: ApiEvseListItem[],
  workOrderItems: ApiWorkOrderAttentionItem[],
  offlineStations: ApiOfflineStation[],
): AttentionGroup[] {
  const groups = new Map<string, AttentionGroup>();

  function groupFor(
    stationId: string,
    stationName: string,
    siteId: string | null,
    siteName: string | null,
  ): AttentionGroup {
    let group = groups.get(stationId);
    if (!group) {
      group = {
        stationId,
        stationName,
        siteId,
        siteName,
        offline: null,
        evseIssues: [],
        workOrders: [],
      };
      groups.set(stationId, group);
    }
    // Sources vary in which fields they carry (WorkOrder has none of
    // siteId/siteName); fill in from whichever source has them, they all
    // refer to the same real station either way.
    if (!group.siteId && siteId) group.siteId = siteId;
    if (!group.siteName && siteName) group.siteName = siteName;
    return group;
  }

  for (const station of offlineStations) {
    const group = groupFor(
      station.stationId,
      station.stationName,
      station.siteId,
      station.siteName,
    );
    group.offline = station;
  }

  for (const evse of evses) {
    if (!evse.requiresAttention) continue;
    const group = groupFor(
      evse.chargingStationId,
      evse.chargingStationName,
      evse.siteId,
      evse.siteName,
    );
    group.evseIssues.push({
      evseId: evse.id,
      evseName: evse.name ?? evse.externalId ?? evse.id,
      reasons: evse.attentionReasons,
    });
  }

  for (const item of workOrderItems) {
    const group = groupFor(
      item.workOrder.stationId,
      item.workOrder.stationName,
      null,
      null,
    );
    group.workOrders.push(item);
  }

  return Array.from(groups.values()).sort(
    (a, b) => attentionGroupRank(a) - attentionGroupRank(b),
  );
}
