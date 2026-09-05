import { describe, expect, it } from 'vitest';
import { mobileProjectionState } from './MobileProjectionState';

describe('mobileProjectionState', () => {
  it('prioritizes a missing device session over a disabled query pending state', () => {
    expect(mobileProjectionState(null, true, null)).toBe('pairing');
  });

  it('keeps an authenticated request outage distinct from its loading state', () => {
    const session = { deviceId: 'device_1', expiresAt: Math.floor(Date.now() / 1000) + 60 };
    expect(mobileProjectionState(session, true, null)).toBe('loading');
    expect(mobileProjectionState(session, false, new Error('service_unavailable'))).toBe('error');
  });
});
