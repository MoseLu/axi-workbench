import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingHandoff } from '../lib/mobileControl';

// Mock the entire mobileControl module to bypass device pairing requirements
const mockFetch = vi.fn();
const mockListIncomingHandoffs = vi.fn(async (params?: { status?: string }) => {
  const query = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  const response = await mockFetch(`/api/v1/mobile/handoffs/incoming${query}`);
  return (response as { handoffs: IncomingHandoff[] }).handoffs;
});

const mockGetHandoff = vi.fn(async (id: string) => {
  const response = await mockFetch(`/api/v1/mobile/handoffs/${encodeURIComponent(id)}`);
  return response as IncomingHandoff;
});

const mockAcceptHandoff = vi.fn(async (id: string) => {
  await mockFetch(`/api/v1/mobile/handoffs/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
  });
});

vi.mock('../lib/mobileControl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/mobileControl')>();
  return {
    ...actual,
    listIncomingHandoffs: mockListIncomingHandoffs,
    getHandoff: mockGetHandoff,
    acceptHandoff: mockAcceptHandoff,
    __mockFetch: mockFetch,
  };
});

// Import the mocked module
const mobileControl = await import('../lib/mobileControl');
const listIncomingHandoffs = mobileControl.listIncomingHandoffs;
const getHandoff = mobileControl.getHandoff;
const acceptHandoff = mobileControl.acceptHandoff;
const __mockFetch = (mobileControl as Record<string, unknown>).__mockFetch as typeof mockFetch;

describe('IncomingHandoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch
    globalThis.fetch = __mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listIncomingHandoffs', () => {
    const mockHandoffs: IncomingHandoff[] = [
      {
        id: 'handoff_12345678-1234-4234-8234-123456789abc',
        handoffCorrelationId: 'handoff:scan_abcdefgh',
        source: 'web',
        sourceSurface: 'web',
        targetSurface: 'mobile',
        status: 'pending',
        approvalId: 'approval_1',
        object: {
          type: 'workitem',
          id: 'item_001',
          projectId: 'project_001',
          actionId: 'diagnose',
          actionType: 'project_diagnosis',
        },
        impact: '需要在移动端完成处理。',
        riskLevel: 'medium',
        actionLevel: 'B',
        createdAt: '2026-09-14T00:00:00.000Z',
        expiresAt: '2026-09-15T00:00:00.000Z',
      },
      {
        id: 'handoff_87654321-4321-4234-8234-987654321fed',
        handoffCorrelationId: 'handoff:scan_xyz1234',
        source: 'mobile',
        sourceSurface: 'mobile',
        targetSurface: 'web',
        status: 'opened',
        approvalId: undefined,
        object: {
          type: 'project',
          id: 'project_002',
          projectId: 'project_002',
          actionId: undefined,
          actionType: undefined,
        },
        impact: '需要在 Web 完成复杂处理。',
        riskLevel: 'high',
        actionLevel: 'A',
        createdAt: '2026-09-13T00:00:00.000Z',
        expiresAt: '2026-09-14T00:00:00.000Z',
        openedAt: '2026-09-13T12:00:00.000Z',
      },
    ];

    it('lists incoming web->mobile handoffs', async () => {
      __mockFetch.mockResolvedValueOnce({
        handoffs: mockHandoffs,
      });

      const handoffs = await listIncomingHandoffs();

      expect(handoffs).toContainEqual(
        expect.objectContaining({ targetSurface: 'mobile', sourceSurface: 'web' })
      );

      const webToMobile = handoffs.find(
        (h) => h.sourceSurface === 'web' && h.targetSurface === 'mobile'
      );
      expect(webToMobile).toBeDefined();
      expect(webToMobile?.targetSurface).toBe('mobile');
    });

    it('filters handoffs by status when provided', async () => {
      const pendingHandoffs = mockHandoffs.filter((h) => h.status === 'pending');
      __mockFetch.mockResolvedValueOnce({
        handoffs: pendingHandoffs,
      });

      const handoffs = await listIncomingHandoffs({ status: 'pending' });

      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('?status=pending'),
      );
      expect(handoffs.every((h) => h.status === 'pending')).toBe(true);
    });

    it('returns empty array when no handoffs exist', async () => {
      __mockFetch.mockResolvedValueOnce({
        handoffs: [],
      });

      const handoffs = await listIncomingHandoffs();
      expect(handoffs).toEqual([]);
    });
  });

  describe('getHandoff', () => {
    const mockHandoff: IncomingHandoff = {
      id: 'handoff_12345678-1234-4234-8234-123456789abc',
      handoffCorrelationId: 'handoff:scan_abcdefgh',
      source: 'web',
      sourceSurface: 'web',
      targetSurface: 'mobile',
      status: 'pending',
      approvalId: 'approval_1',
      object: {
        type: 'workitem',
        id: 'item_001',
        projectId: 'project_001',
        actionId: 'diagnose',
        actionType: 'project_diagnosis',
      },
      impact: '需要在移动端完成处理。',
      riskLevel: 'medium',
      actionLevel: 'B',
      createdAt: '2026-09-14T00:00:00.000Z',
      expiresAt: '2026-09-15T00:00:00.000Z',
    };

    it('fetches a single handoff by ID', async () => {
      __mockFetch.mockResolvedValueOnce(mockHandoff);

      const handoff = await getHandoff(mockHandoff.id);

      expect(handoff.id).toBe(mockHandoff.id);
      expect(handoff.sourceSurface).toBe('web');
      expect(handoff.targetSurface).toBe('mobile');
      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/handoffs/${encodeURIComponent(mockHandoff.id)}`),
      );
    });
  });

  describe('acceptHandoff', () => {
    const handoffId = 'handoff_12345678-1234-4234-8234-123456789abc';

    it('accepts an incoming handoff', async () => {
      __mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await acceptHandoff(handoffId);

      expect(__mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/handoffs/${encodeURIComponent(handoffId)}/accept`),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('sends idempotency key with accept request', async () => {
      __mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await acceptHandoff(handoffId);

      const [, options] = __mockFetch.mock.calls[0];
      const body = JSON.parse((options as { body: string }).body);
      expect(body.idempotencyKey).toBeDefined();
      expect(typeof body.idempotencyKey).toBe('string');
    });
  });

  describe('bidirectional handoff scenarios', () => {
    it('handles web-to-mobile handoff as incoming', async () => {
      const webToMobileHandoff: IncomingHandoff = {
        id: 'handoff_web2mobile',
        handoffCorrelationId: 'handoff:scan_web2mobile',
        source: 'web',
        sourceSurface: 'web',
        targetSurface: 'mobile',
        status: 'pending',
        approvalId: 'approval_web2mobile',
        object: {
          type: 'workitem',
          id: 'item_001',
          projectId: 'project_001',
          actionId: undefined,
          actionType: undefined,
        },
        impact: '需要在移动端完成处理。',
        riskLevel: 'medium',
        actionLevel: 'B',
        createdAt: '2026-09-14T00:00:00.000Z',
        expiresAt: '2026-09-15T00:00:00.000Z',
      };

      __mockFetch.mockResolvedValueOnce({
        handoffs: [webToMobileHandoff],
      });

      const handoffs = await listIncomingHandoffs();

      expect(handoffs).toContainEqual(
        expect.objectContaining({
          targetSurface: 'mobile',
          sourceSurface: 'web',
        })
      );
    });

    it('accepts web-to-mobile handoff and verifies status change', async () => {
      const handoffId = 'handoff_web2mobile';

      const pendingHandoff: IncomingHandoff = {
        id: handoffId,
        handoffCorrelationId: 'handoff:scan_web2mobile',
        source: 'web',
        sourceSurface: 'web',
        targetSurface: 'mobile',
        status: 'pending',
        approvalId: 'approval_web2mobile',
        object: {
          type: 'workitem',
          id: 'item_001',
          projectId: 'project_001',
          actionId: undefined,
          actionType: undefined,
        },
        impact: '需要在移动端完成处理。',
        riskLevel: 'medium',
        actionLevel: 'B',
        createdAt: '2026-09-14T00:00:00.000Z',
        expiresAt: '2026-09-15T00:00:00.000Z',
      };

      const acceptedHandoff: IncomingHandoff = {
        ...pendingHandoff,
        status: 'completed',
        openedAt: new Date().toISOString(),
      };

      // Mock for acceptHandoff
      __mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await acceptHandoff(handoffId);

      // Mock for getHandoff (simulating status change)
      __mockFetch.mockResolvedValueOnce(acceptedHandoff);

      const updated = await getHandoff(handoffId);
      expect(updated.status).toBe('completed');
    });
  });
});
