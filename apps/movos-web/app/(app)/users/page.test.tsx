import { describe, expect, it, vi } from 'vitest';

const redirect = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

import UsersPage from './page';

// WO-ARGOS-090 §3, §13.1/§13.2 — /users must contain no fabricated users
// and must resolve to real membership management, not a dead end or a
// second fake implementation.
describe('/users', () => {
  it('redirects to the real membership management tab, never renders fabricated users', () => {
    UsersPage();

    expect(redirect).toHaveBeenCalledWith('/settings?tab=operators');
  });
});
