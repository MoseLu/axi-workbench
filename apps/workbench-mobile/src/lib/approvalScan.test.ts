import { describe, expect, it } from 'vitest';
import { parseApprovalScanPayload } from './approvalScan';

describe('parseApprovalScanPayload', () => {
  it('accepts only an opaque Axi approval URI', () => {
    expect(parseApprovalScanPayload('axi://approval/scan_abcdefgh-12345678')).toEqual({ scanToken: 'scan_abcdefgh-12345678' });
  });

  it('rejects OIDC tickets and business identifiers', () => {
    expect(() => parseApprovalScanPayload('https://axi.example/api/v1/auth/qr/transactions/tx/approve?ticket=secret')).toThrow();
    expect(() => parseApprovalScanPayload('axi://approval/scan_abcdefgh?projectId=project-1')).toThrow();
  });
});
