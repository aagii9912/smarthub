/**
 * Supabase query builder-ийн энгийн mock: ямар ч chain (`.from().select().eq()…`)
 * хүлээн авч, `await` хийхэд эсвэл `.maybeSingle()`/`.single()` дуудахад
 * тухайн хүснэгтэд өгсөн хариуг буцаана. Дуудагдсан filter-үүдийг `calls`-д бичнэ.
 */

type Result = { data: unknown; error: { message: string } | null };

export function mockSupabase(tables: Record<string, Result>) {
    const calls: { table: string; method: string; args: unknown[] }[] = [];

    function builder(table: string) {
        const result = tables[table] ?? { data: null, error: null };
        const proxy: Record<string, unknown> = new Proxy(
            {},
            {
                get(_t, prop: string) {
                    if (prop === 'then') {
                        return (resolve: (r: Result) => unknown) => resolve(result);
                    }
                    if (prop === 'maybeSingle' || prop === 'single') {
                        return () =>
                            Promise.resolve({
                                ...result,
                                data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
                            });
                    }
                    return (...args: unknown[]) => {
                        calls.push({ table, method: prop, args });
                        return proxy;
                    };
                },
            },
        );
        return proxy;
    }

    return {
        client: { from: (table: string) => builder(table) },
        calls,
    };
}
