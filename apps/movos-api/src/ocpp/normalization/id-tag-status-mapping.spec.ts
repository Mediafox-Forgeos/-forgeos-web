import { idTagStatusFor } from './id-tag-status-mapping';

describe('idTagStatusFor', () => {
  it.each([
    ['ACCEPTED', 'Accepted'],
    ['OFFLINE_ACCEPTED', 'Accepted'],
    ['REVOKED', 'Blocked'],
    ['REJECTED', 'Blocked'],
    ['EXPIRED', 'Expired'],
    ['UNKNOWN', 'Invalid'],
  ] as const)('maps %s to idTagInfo.status %s', (result, expected) => {
    expect(idTagStatusFor(result)).toBe(expected);
  });
});
