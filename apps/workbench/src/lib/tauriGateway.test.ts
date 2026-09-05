import { describe, expect, it } from 'vitest';
import {
  isPackagedTauriOrigin,
  resolveNativeGatewayBaseURL,
  shouldUseNativeGatewayRequest,
} from './tauriGateway';

describe('tauriGateway routing', () => {
  it.each([
    'tauri://localhost/login',
    'http://tauri.localhost/login',
  ])('recognizes the packaged Tauri origin: %s', (pageURL) => {
    expect(isPackagedTauriOrigin(pageURL)).toBe(true);
    expect(shouldUseNativeGatewayRequest('/api/v1/auth/session', pageURL)).toBe(true);
  });

  it('keeps Vite browser requests on the browser proxy', () => {
    expect(shouldUseNativeGatewayRequest('/api/v1/auth/session', 'http://127.0.0.1:5183/login')).toBe(false);
  });

  it('keeps an explicit local Gateway URL available to the native adapter', () => {
    expect(shouldUseNativeGatewayRequest(
      'http://127.0.0.1:8088/api/v1/auth/session',
      'http://127.0.0.1:5183/login',
    )).toBe(true);
  });

  it('does not hijack remote browser requests', () => {
    expect(shouldUseNativeGatewayRequest(
      'https://workbench.axiomaticworld.com/api/v1/auth/session',
      'https://workbench.axiomaticworld.com/login',
    )).toBe(false);
  });

  it('uses the local Gateway unless a build supplies a public base URL', () => {
    expect(resolveNativeGatewayBaseURL('')).toBe('http://127.0.0.1:8088');
    expect(resolveNativeGatewayBaseURL('https://workbench.axiomaticworld.com/')).toBe(
      'https://workbench.axiomaticworld.com/',
    );
  });
});
