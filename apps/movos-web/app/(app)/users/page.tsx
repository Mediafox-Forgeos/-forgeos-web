import { redirect } from 'next/navigation';

// WO-ARGOS-090 — this route used to render a fully fabricated user list
// (`@/data/users`, hardcoded rows, "la autenticación aún no está conectada"
// — false since WO-ARGOS-089). WO-089 already built the real membership
// surface at Settings → Operadores; maintaining a second, fake
// implementation here would violate PRIMARY_NAVIGATION_MUST_NOT_PRESENT_
// FABRICATED_OPERATIONAL_DATA_AS_REAL. Rather than deleting the route
// outright (an old bookmark/link would 404), it honestly redirects to the
// real thing.
export default function UsersPage() {
  redirect('/settings?tab=operators');
}
