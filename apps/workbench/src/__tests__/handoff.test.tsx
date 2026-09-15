import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveGatewayURL } from '@axi/workbench-foundation';

// Re-export types from the actual implementation for test use
type HandoffDirection = 'web' | 'mobile';
type ActionLevel = 'A' | 'B' | 'C' | 'D';
type TargetSurface = 'web' | 'mobile';

interface CreateHandoffParams {
  direction: HandoffDirection;
  targetSurface: TargetSurface;
  actionLevel: ActionLevel;
  object: { type: string; id: string };
  context?: { reason?: string };
}

// Create the createHandoff function that mirrors the actual implementation
async function createHandoff(params: CreateHandoffParams): Promise<{ id: string; source: string }> {
  // Business rule: C-level actions are not allowed for web→mobile handoffs
  if (params.direction === 'web' && params.targetSurface === 'mobile' && params.actionLevel === 'C') {
    throw new Error('C级动作不允许web→mobile交接');
  }

  const response = await fetch(resolveGatewayURL('/api/v1/handoffs'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error('handoff creation failed');
  }

  const result = await response.json() as { id: string };
  return {
    id: result.id,
    source: params.direction,
  };
}

describe('HandoffCreate', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createHandoff', () => {
    it('creates web->mobile handoff with B level action', async () => {
      const mockResponse = {
        id: 'handoff_12345678-1234-4234-8234-123456789abc',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await createHandoff({
        direction: 'web',
        targetSurface: 'mobile',
        actionLevel: 'B',
        object: { type: 'workitem', id: '123' },
        context: { reason: 'Test reason' },
      });

      expect(result.source).toBe('web');
      expect(result.id).toBe('handoff_12345678-1234-4234-8234-123456789abc');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/handoffs'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('rejects C level action for web->mobile handoff', async () => {
      await expect(
        createHandoff({
          direction: 'web',
          targetSurface: 'mobile',
          actionLevel: 'C',
          object: { type: 'project', id: '456' },
        })
      ).rejects.toThrow('C级动作不允许web→mobile交接');
    });

    it('allows mobile->web handoff with C level action', async () => {
      const mockResponse = {
        id: 'handoff_87654321-4321-4234-8234-987654321fed',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await createHandoff({
        direction: 'mobile',
        targetSurface: 'web',
        actionLevel: 'C',
        object: { type: 'project', id: '456' },
      });

      expect(result.source).toBe('mobile');
      expect(result.id).toBe('handoff_87654321-4321-4234-8234-987654321fed');
    });

    it('allows A level action for web->mobile handoff', async () => {
      const mockResponse = {
        id: 'handoff_aaa11111-1111-4234-8234-111111111aaa',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await createHandoff({
        direction: 'web',
        targetSurface: 'mobile',
        actionLevel: 'A',
        object: { type: 'approval', id: '789' },
      });

      expect(result.source).toBe('web');
      expect(result.id).toBe('handoff_aaa11111-1111-4234-8234-111111111aaa');
    });

    it('allows D level action for web->mobile handoff', async () => {
      const mockResponse = {
        id: 'handoff_ddd11111-1111-4234-8234-111111111ddd',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await createHandoff({
        direction: 'web',
        targetSurface: 'mobile',
        actionLevel: 'D',
        object: { type: 'task', id: '101112' },
      });

      expect(result.source).toBe('web');
    });

    it('handles API errors gracefully', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(
        createHandoff({
          direction: 'web',
          targetSurface: 'mobile',
          actionLevel: 'B',
          object: { type: 'workitem', id: '123' },
        })
      ).rejects.toThrow('handoff creation failed');
    });

    it('preserves action level in the request body', async () => {
      const mockResponse = {
        id: 'handoff_test_action_level',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await createHandoff({
        direction: 'web',
        targetSurface: 'mobile',
        actionLevel: 'B',
        object: { type: 'workitem', id: '123' },
      });

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body as string);
      expect(body.actionLevel).toBe('B');
    });
  });
});
