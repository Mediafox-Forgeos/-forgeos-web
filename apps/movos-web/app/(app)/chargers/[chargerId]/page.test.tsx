import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

import { redirect } from 'next/navigation';
import ChargerDetailPage from './page';

describe('/chargers/[chargerId]', () => {
  it('redirects to the /chargers gateway instead of rendering a mock charger', () => {
    ChargerDetailPage();
    expect(redirect).toHaveBeenCalledWith('/chargers');
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
