import { beforeEach, describe, expect, it } from 'vitest';
import { DemoRepository, __resetDemoStore } from '@/lib/data/demo-repository';
import { DEMO_ORGS } from '@/lib/demo/seed';
import { summarizeCoverage } from '@/lib/coverage';
import type { Viewer } from '@/lib/data/repository';

const v = (userId: string): Viewer => ({
  userId,
  name: userId,
  email: '',
  mode: 'demo',
});
const [CLINIC, BANK] = [DEMO_ORGS[0].id, DEMO_ORGS[1].id];

describe('repositorio demo', () => {
  beforeEach(() => __resetDemoStore());
  const repo = new DemoRepository();

  it('todos los datos son sintéticos y de su organización', async () => {
    for (const org of [CLINIC, BANK]) {
      const items = await repo.items(org);
      expect(items.length).toBeGreaterThan(0);
      expect(
        items.every((i) => i.isSynthetic && i.organizationId === org),
      ).toBe(true);
      expect(
        (await repo.alerts(org)).every(
          (a) => a.isSynthetic && a.organizationId === org,
        ),
      ).toBe(true);
    }
  });
  it('membresías: el usuario del banco no ve la clínica', async () => {
    const ms = await repo.memberships(v('demo-user-bank'));
    expect(ms.map((m) => m.organization.id)).toEqual([BANK]);
  });
  it('acciones exigen membresía y rol', async () => {
    const [alert] = (await repo.alerts(CLINIC)).filter(
      (a) => a.reviewStatus === 'pending',
    );
    await expect(
      repo.reviewAlert(CLINIC, alert!.id, 'confirmed', v('demo-user-bank')),
    ).rejects.toThrow(/Sin acceso/);
    await expect(
      repo.reviewAlert(CLINIC, alert!.id, 'confirmed', v('demo-user-viewer')),
    ).rejects.toThrow(/Rol/);
    await expect(
      repo.reviewAlert(CLINIC, alert!.id, 'confirmed', v('demo-user-analyst')),
    ).resolves.toBeUndefined();
  });
  it('alerta crítica sin revisión no abre incidente', async () => {
    const crit = (await repo.alerts(CLINIC)).find(
      (a) => a.severity === 'critical' && a.reviewStatus === 'pending',
    );
    expect(crit).toBeDefined();
    await expect(
      repo.openIncidentFromAlert(CLINIC, crit!.id, v('demo-user-responder')),
    ).rejects.toThrow(/revisión humana/);
  });
  it('flujo completo de incidente con historial', async () => {
    const alert = (await repo.alerts(CLINIC)).find(
      (a) => a.severity === 'high' && !a.incidentId,
    )!;
    const id = await repo.openIncidentFromAlert(
      CLINIC,
      alert.id,
      v('demo-user-responder'),
    );
    await repo.assignIncident(
      CLINIC,
      id,
      'demo-user-responder',
      v('demo-user-analyst'),
    );
    await expect(
      repo.assignIncident(
        CLINIC,
        id,
        'demo-user-viewer',
        v('demo-user-analyst'),
      ),
    ).rejects.toThrow();
    for (const s of [
      'acknowledged',
      'investigating',
      'responding',
      'resolved',
    ] as const)
      await repo.transitionIncident(CLINIC, id, s, v('demo-user-responder'));
    await expect(
      repo.transitionIncident(CLINIC, id, 'closed', v('demo-user-responder')),
    ).rejects.toThrow(/resumen/);
    await repo.transitionIncident(
      CLINIC,
      id,
      'closed',
      v('demo-user-responder'),
      'Servicio restablecido y respuesta publicada',
    );
    const inc = await repo.incident(CLINIC, id);
    expect(inc?.status).toBe('closed');
    expect(inc?.events.map((e) => e.kind)).toEqual([
      'opened',
      'assigned',
      'status_changed',
      'status_changed',
      'status_changed',
      'status_changed',
      'closed',
    ]);
  });
  it('cobertura declara lo no escuchado', async () => {
    const s = summarizeCoverage(await repo.coverage(CLINIC));
    expect(s.connected.every((c) => c.includes('(ficticio)'))).toBe(true);
    expect(s.missing.length).toBeGreaterThan(3);
    // Lo que alguna fuente cubre no se declara como no escuchado.
    expect(s.missing).not.toContain('comentarios de Instagram');
    expect(s.missing).toContain('comentarios de TikTok');
  });
  it('WhatsApp demo: solo simulado y respeta opt-in', async () => {
    const d = await repo.waDispatches(CLINIC);
    expect(d.some((x) => x.status === 'simulated')).toBe(true);
    expect(d.find((x) => x.recipientId.endsWith('wa-3'))?.status).toBe(
      'suppressed',
    );
    expect(d.every((x) => x.status !== 'queued')).toBe(true);
  });
});
