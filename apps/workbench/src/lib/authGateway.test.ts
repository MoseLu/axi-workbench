import { describe, expect, it } from 'vitest';
import { normalizeGatewayBaseURL } from '@axi/workbench-foundation/auth';

describe('normalizeGatewayBaseURL', () => {
  it('uses the same-origin Vite proxy for mismatched loopback hostnames', () => {
    expect(normalizeGatewayBaseURL('http://localhost:8088', 'http://127.0.0.1:5173')).toBe('');
  });

  it('preserves same-host and deployed gateway URLs', () => {
    expect(normalizeGatewayBaseURL('http://localhost:8088', 'http://localhost:5173')).toBe('http://localhost:8088');
    expect(normalizeGatewayBaseURL('https://api.axi.example', 'https://workbench.axi.example')).toBe('https://api.axi.example');
  });
});
