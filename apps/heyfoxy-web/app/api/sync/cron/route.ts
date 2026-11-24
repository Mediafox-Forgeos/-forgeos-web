import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { connectedMetricoolOrgs } from '@/lib/sync/supabase-store';
import {
  killSwitchOn,
  panelMode,
  scheduleEnabled,
  syncNow,
} from '@/lib/sync/service';

export const dynamic = 'force-dynamic';

/**
 * Sincronización programada (preparada, DESACTIVADA). No está registrada en ninguna
 * configuración de cron: activarla requiere GO, HF_SYNC_SCHEDULE_ENABLED=true y CRON_SECRET.
 * Respeta el interruptor de emergencia y la pausa de cada organización.
 */
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') ?? '';
  if (!secret) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!scheduleEnabled() || panelMode() !== 'live')
    return NextResponse.json(
      { ok: false, reason: 'sincronización programada desactivada' },
      { status: 503 },
    );
  if (!authorized(req))
    return NextResponse.json({ ok: false }, { status: 401 });
  if (killSwitchOn())
    return NextResponse.json(
      { ok: false, reason: 'interruptor de emergencia activo' },
      { status: 503 },
    );
  const results: Array<{ org: string; status: string }> = [];
  for (const org of await connectedMetricoolOrgs()) {
    try {
      results.push({ org, status: (await syncNow(org, 'scheduled')).status });
    } catch {
      results.push({ org, status: 'error' });
    }
  }
  return NextResponse.json({ ok: true, results });
}
