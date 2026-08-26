import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/settings/members-section', () => ({
  MembersSection: () => <div>MEMBERS_SECTION_MARKER</div>,
}));
vi.mock('@/components/settings/credentials-section', () => ({
  CredentialsSection: () => <div>CREDENTIALS_SECTION_MARKER</div>,
}));

import SettingsPage from './page';

// WO-ARGOS-090 — /users now redirects to /settings?tab=operators instead of
// dead-ending on a fabricated user list; this confirms that query param
// actually lands the visitor on the real membership tab, not just the
// default first tab.
describe('SettingsPage — tab deep-linking', () => {
  it('defaults to the Operadores tab when ?tab=operators is present', async () => {
    const jsx = await SettingsPage({
      searchParams: Promise.resolve({ tab: 'operators' }),
    });
    render(jsx);

    expect(screen.getByText('MEMBERS_SECTION_MARKER')).toBeInTheDocument();
  });

  it('falls back to the first tab when no tab param is present', async () => {
    const jsx = await SettingsPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(
      screen.queryByText('MEMBERS_SECTION_MARKER'),
    ).not.toBeInTheDocument();
  });

  it('ignores an unrecognized tab value rather than crashing', async () => {
    const jsx = await SettingsPage({
      searchParams: Promise.resolve({ tab: 'not-a-real-tab' }),
    });
    render(jsx);

    expect(
      screen.queryByText('MEMBERS_SECTION_MARKER'),
    ).not.toBeInTheDocument();
  });
});
