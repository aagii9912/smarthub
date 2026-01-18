import { vi } from 'vitest';

/**
 * Mock Supabase response type
 */
interface MockSupabaseResponse<T = unknown> {
    data: T | null;
    error: Error | null;
}

/**
 * Create a mock query builder that chains methods
 */
function createMockQueryBuilder() {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {};

    // All chainable methods return the builder itself
    const chainableMethods = [
        'from', 'select', 'insert', 'update', 'delete',
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'like', 'ilike', 'in', 'order', 'limit'
    ];

    chainableMethods.forEach(method => {
        builder[method] = vi.fn(() => builder);
    });

    // Terminal methods return promises
    builder.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));

    return builder;
}

/**
 * Mock Supabase client for testing
 */
export const mockSupabaseClient = createMockQueryBuilder();

/**
 * Mock Supabase admin function
 */
export const mockSupabaseAdmin = vi.fn(() => mockSupabaseClient);

/**
 * Reset all mocks
 */
export function resetSupabaseMocks() {
    Object.values(mockSupabaseClient).forEach((mock) => {
        if (typeof mock === 'function' && 'mockClear' in mock) {
            (mock as ReturnType<typeof vi.fn>).mockClear();
        }
    });
    mockSupabaseAdmin.mockClear();
}

/**
 * Configure mock to return specific data for .single() calls
 */
export function mockSupabaseResponse<T>(data: T, error: Error | null = null): MockSupabaseResponse<T> {
    const response = { data, error };
    mockSupabaseClient.single.mockResolvedValueOnce(response);
    return response;
}

/**
 * Configure mock to return array data (for queries without .single())
 */
export function mockSupabaseArrayResponse<T>(data: T[], error: Error | null = null): MockSupabaseResponse<T[]> {
    const response = { data, error };
    // For array responses that end with .limit() or similar
    mockSupabaseClient.limit.mockResolvedValueOnce(response);
    return response;
}

/**
 * Configure mock to return error
 */
export function mockSupabaseError(message: string): MockSupabaseResponse<null> {
    const error = new Error(message);
    const response = { data: null, error };
    mockSupabaseClient.single.mockResolvedValueOnce(response);
    return response;
}
