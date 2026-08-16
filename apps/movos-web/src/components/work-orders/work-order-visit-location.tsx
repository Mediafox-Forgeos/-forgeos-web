import type { ApiWorkOrderVisitLocation } from '@mediafox/shared-types';

/**
 * WO-ARGOS-049 — always derived (WorkOrder -> ChargingStation -> Site),
 * never a field the caller enters directly. Shared by both operator and
 * technician detail pages so the two never drift.
 */
export function WorkOrderVisitLocation({
  location,
}: {
  location: ApiWorkOrderVisitLocation;
}) {
  return (
    <div className="space-y-0.5 text-sm">
      <p className="font-medium">{location.siteName}</p>
      {location.formattedAddress && (
        <p className="text-muted-foreground text-xs">
          {location.formattedAddress}
        </p>
      )}
      <p className="text-muted-foreground text-xs">{location.stationName}</p>
    </div>
  );
}
