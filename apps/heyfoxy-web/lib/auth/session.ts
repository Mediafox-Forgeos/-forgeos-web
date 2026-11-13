import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dataMode } from '@/lib/env';
import { DemoRepository } from '@/lib/data/demo-repository';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { supabaseServer } from '@/lib/supabase/server';
import { DEMO_USERS } from '@/lib/demo/seed';
import type { Membership, Repository, Viewer } from '@/lib/data/repository';

export const DEMO_COOKIE = 'hf_demo_user';
export const ORG_COOKIE = 'hf_org';

export function repository(): Repository {
  return dataMode() === 'supabase'
    ? new SupabaseRepository()
    : new DemoRepository();
}

export async function currentViewer(): Promise<Viewer | null> {
  if (dataMode() === 'demo') {
    const id = (await cookies()).get(DEMO_COOKIE)?.value;
    const u = DEMO_USERS.find((x) => x.id === id);
    return u
      ? { userId: u.id, name: u.name, email: u.email, mode: 'demo' }
      : null;
  }
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  return {
    userId: data.user.id,
    name: data.user.email ?? 'Usuario',
    email: data.user.email ?? '',
    mode: 'supabase',
  };
}

export interface AppContext {
  viewer: Viewer;
  memberships: Membership[];
  active: Membership;
  repo: Repository;
}

/** Resuelve usuario + organización activa; la org siempre debe ser una membresía real. */
export async function requireContext(): Promise<AppContext> {
  const viewer = await currentViewer();
  if (!viewer) redirect('/login');
  const repo = repository();
  const memberships = await repo.memberships(viewer);
  if (memberships.length === 0) redirect('/login?error=sin-organizacion');
  const wanted = (await cookies()).get(ORG_COOKIE)?.value;
  const active =
    memberships.find((m) => m.organization.id === wanted) ?? memberships[0]!;
  return { viewer, memberships, active, repo };
}
