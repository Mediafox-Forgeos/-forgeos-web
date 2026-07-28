import { redirect } from 'next/navigation';

/**
 * /stations used to render mock Station records as if they were live
 * operational data. Per ARGOS's WO-ARGOS-005 ruling, MOVOS does not get an
 * org-wide "list all stations" endpoint — Site is the real, production-ready
 * inventory (see /sites), and ChargingStation is reached by drilling into a
 * Site's Infraestructura tab. Rather than duplicate that screen, this route
 * redirects to it. Kept as a real Next.js redirect (not a client-side
 * useEffect push) so it also resolves correctly for direct navigation and
 * bookmarks, not just in-app link clicks.
 */
export default function StationsPage(): never {
  redirect('/sites');
}
