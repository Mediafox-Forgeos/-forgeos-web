'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireContext } from '@/lib/auth/session';
import {
  connectBrand,
  disconnect,
  resetSimulation,
  setPaused,
  syncNow,
} from '@/lib/sync/service';

/**
 * Acciones de la fuente Metricool. Solo owner/admin de la organización activa; la
 * organización sale de la sesión, nunca del formulario. Ninguna acción escribe en las redes.
 */
async function manager() {
  const { active } = await requireContext();
  if (!['owner', 'admin'].includes(active.role))
    redirect('/cobertura?aviso=sin-permiso');
  return active.organization.id;
}

function done(msg: string): never {
  revalidatePath('/cobertura');
  redirect(`/cobertura?aviso=${encodeURIComponent(msg)}`);
}

export async function syncAction() {
  const org = await manager();
  let msg: string;
  try {
    const r = await syncNow(org);
    msg = `sync-${r.status}`;
  } catch {
    msg = 'sync-error';
  }
  done(msg);
}

export async function pauseAction(formData: FormData) {
  const org = await manager();
  const paused = formData.get('paused') === 'true';
  await setPaused(org, paused);
  done(paused ? 'pausada' : 'reanudada');
}

export async function disconnectAction(formData: FormData) {
  const org = await manager();
  if (formData.get('confirm') !== 'DESCONECTAR')
    done('desconexion-sin-confirmar');
  await disconnect(org);
  done('desconectada');
}

export async function connectAction(formData: FormData) {
  const org = await manager();
  const blogId = String(formData.get('blogId') ?? '').slice(0, 32);
  if (!/^\d+$/.test(blogId)) done('marca-invalida');
  try {
    await connectBrand(org, blogId);
  } catch {
    done('conexion-error');
  }
  done('conectada');
}

export async function resetSimulationAction() {
  const org = await manager();
  await resetSimulation(org);
  done('simulacion-reiniciada');
}
