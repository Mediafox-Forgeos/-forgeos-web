import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { redirect } from 'next/navigation';
import StationsPage from './page';

describe('/stations', () => {
  it('redirects to /sites instead of rendering mock Station records', () => {
    StationsPage();
    expect(redirect).toHaveBeenCalledWith('/sites');
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
