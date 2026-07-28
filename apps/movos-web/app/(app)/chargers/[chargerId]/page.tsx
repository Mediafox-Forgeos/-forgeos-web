import { redirect } from 'next/navigation';

/**
 * This route used to render a mock Charger record (fake status, fake
 * connectors, fake sessions) as if it were a real, live device. Per
 * WO-ARGOS-005, mock infrastructure must not appear as live operational
 * data anywhere, including on deep links to a specific fake id. Real EVSE
 * detail pages now exist at
 * /sites/[siteId]/charging-stations/[stationId]/evses/[evseId] — but a mock
 * chargerId here has no corresponding real EVSE to redirect to, so this
 * falls back to the Site-selection gateway instead of a dead link or a 404.
 */
export default function ChargerDetailPage(): never {
  redirect('/chargers');
}
