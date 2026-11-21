import 'server-only';
import { cookies } from 'next/headers';
import type { AppContext } from '@/lib/auth/session';
import { UI_COOKIE, parseUiTheme, type UiTheme } from '@/lib/ui-theme';

export type ShellContext = Pick<
  AppContext,
  'viewer' | 'memberships' | 'active'
>;

/** Preferencia de tema del usuario (solo presentación). */
export async function getUiTheme(): Promise<UiTheme> {
  return parseUiTheme((await cookies()).get(UI_COOKIE)?.value);
}
