/**
 * Runtime shape tests for the `@axi/types` API surface.
 *
 * The `ApiResponse<T>` and `PaginatedResponse<T>` types in `api.ts` are now
 * derived from the `@axi/workstation-contracts` Zod schemas via
 * `z.infer<ReturnType<typeof ...Schema<...>>>`. To prevent silent drift
 * between the inferred shape and what the runtime actually parses, these
 * tests validate a representative payload through the same schemas and
 * assert that the inferred fields line up.
 */
import { describe, expect, it } from 'vitest';
import {
  ApiResponseSchema,
  PaginatedResponseSchema,
} from '@axi/workstation-contracts';
import { z } from 'zod';

describe('ApiResponse shape parity', () => {
  it('parses a successful response with data', () => {
    const schema = ApiResponseSchema(z.object({ id: z.string(), name: z.string() }));

    const parsed = schema.parse({
      code: 200,
      message: 'ok',
      data: { id: '1', name: 'Alice' },
    });

    expect(parsed).toEqual({
      code: 200,
      message: 'ok',
      data: { id: '1', name: 'Alice' },
    });
  });

  it('treats data as optional so error responses stay parseable', () => {
    const schema = ApiResponseSchema(z.object({ id: z.string() }));

    const parsed = schema.parse({
      code: 401,
      message: 'unauthorized',
    });

    expect(parsed.code).toBe(401);
    expect(parsed.message).toBe('unauthorized');
    expect(parsed.data).toBeUndefined();
  });

  it('rejects payloads with the wrong top-level shape', () => {
    const schema = ApiResponseSchema(z.object({ id: z.string() }));

    expect(() =>
      schema.parse({ code: 'not-a-number', message: 'oops' } as unknown),
    ).toThrow();
  });
});

describe('PaginatedResponse shape parity', () => {
  const item = z.object({ id: z.string() });

  it('parses a representative paginated payload', () => {
    const schema = PaginatedResponseSchema(item);

    const parsed = schema.parse({
      items: [{ id: '1' }, { id: '2' }],
      total: 12,
      page: 1,
      pageSize: 10,
      totalPages: 2,
    });

    expect(parsed.total).toBe(12);
    expect(parsed.totalPages).toBe(2);
    expect(parsed.items).toHaveLength(2);
  });

  it('rejects negative totals', () => {
    const schema = PaginatedResponseSchema(item);

    expect(() =>
      schema.parse({ items: [], total: -1, page: 1, pageSize: 10, totalPages: 0 }),
    ).toThrow();
  });

  it('rejects non-integer pagination fields', () => {
    const schema = PaginatedResponseSchema(item);

    expect(() =>
      schema.parse({
        items: [],
        total: 1,
        page: 1.5,
        pageSize: 10,
        totalPages: 1,
      }),
    ).toThrow();
  });
});