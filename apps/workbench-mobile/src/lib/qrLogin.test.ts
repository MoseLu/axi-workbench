import { describe, expect, it } from 'vitest';
import { parseQRApprovalPayload, qrApprovalEndpoint } from './qrLogin';

const transactionId = 'a07db7e7-3e64-48a5-9fd6-925da7913289';
const ticket = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_1234567';
const validPayload = `https://api.axi.test/api/v1/auth/qr/transactions/${transactionId}/approve?ticket=${ticket}&v=1`;

describe('Axi QR 登录审批载荷', () => {
  it('只接受 Identity Adapter 生成的审批 URL，并把票据留在内存中', () => {
    expect(parseQRApprovalPayload(validPayload)).toEqual({ transactionId, ticket });
    expect(qrApprovalEndpoint(transactionId)).toBe(`/api/v1/auth/qr/transactions/${transactionId}/approve`);
  });

  it.each([
    'mailto:team@axi.test',
    `https://api.axi.test/api/v1/auth/qr/transactions/${transactionId}/resume?ticket=${ticket}`,
    `https://api.axi.test/api/v1/auth/qr/transactions/${transactionId}/approve?ticket=${ticket}&ticket=${ticket}`,
    `https://api.axi.test/api/v1/auth/qr/transactions/${transactionId}/approve?ticket=short`,
    `/api/v1/auth/qr/transactions/${transactionId}/approve?ticket=${ticket}`,
  ])('拒绝非审批载荷：%s', (payload) => {
    expect(() => parseQRApprovalPayload(payload)).toThrow();
  });
});
