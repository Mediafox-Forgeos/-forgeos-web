/**
 * Clasifica la clave de Supabase configurada para el servidor SIN validarla contra la red y sin
 * devolverla nunca. Acepta la clave secreta nueva (`sb_secret_…`, recomendada: se puede crear con
 * nombre propio y revocar sin afectar a nada más) y la `service_role` antigua (JWT; Supabase la
 * retira a finales de 2026). Rechaza las claves públicas: con ellas el servidor no podría escribir
 * y, peor, indicarían que se pegó la clave equivocada.
 */
export type ServiceKeyKind =
  | 'secret'
  | 'service_role_jwt'
  | 'publishable'
  | 'anon_jwt'
  | 'missing'
  | 'unknown';

export function serviceKeyKind(key: string | undefined | null): ServiceKeyKind {
  const k = (key ?? '').trim();
  if (!k) return 'missing';
  if (/^sb_secret_[A-Za-z0-9_-]{10,}$/.test(k)) return 'secret';
  if (k.startsWith('sb_publishable_')) return 'publishable';
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1]!, 'base64url').toString('utf8'),
      ) as { role?: unknown };
      if (payload.role === 'service_role') return 'service_role_jwt';
      if (payload.role === 'anon') return 'anon_jwt';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}

export const serviceKeyUsable = (kind: ServiceKeyKind) =>
  kind === 'secret' || kind === 'service_role_jwt';

/** Mensaje para la lista de pendientes (sin revelar la clave). */
export function serviceKeyProblem(kind: ServiceKeyKind): string | null {
  switch (kind) {
    case 'secret':
    case 'service_role_jwt':
      return null;
    case 'missing':
      return 'Falta HF_SUPABASE_SERVICE_ROLE_KEY (clave secreta de heyfoxy-qa) en el servidor';
    case 'publishable':
    case 'anon_jwt':
      return 'HF_SUPABASE_SERVICE_ROLE_KEY contiene una clave PÚBLICA: debe ser una clave secreta (sb_secret_…) de heyfoxy-qa';
    default:
      return 'HF_SUPABASE_SERVICE_ROLE_KEY no tiene un formato de clave secreta de Supabase (sb_secret_…)';
  }
}

/**
 * Vinculaciones autorizadas organización → marca de Metricool, desde
 * HF_METRICOOL_ALLOWED_BRANDS = "<orgId>:<blogId>[,<orgId>:<blogId>…]".
 * Entradas mal formadas se ignoran (y se informan como pendientes).
 */
export function parseAllowedBrands(raw: string | undefined | null): {
  byOrg: Map<string, Set<string>>;
  invalid: number;
} {
  const byOrg = new Map<string, Set<string>>();
  let invalid = 0;
  for (const entry of (raw ?? '').split(',')) {
    const e = entry.trim();
    if (!e) continue;
    const m =
      /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{1,20})$/i.exec(
        e,
      );
    if (!m) {
      invalid++;
      continue;
    }
    const org = m[1]!.toLowerCase();
    if (!byOrg.has(org)) byOrg.set(org, new Set());
    byOrg.get(org)!.add(m[2]!);
  }
  return { byOrg, invalid };
}
