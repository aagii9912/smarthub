/**
 * Writing rows that contain columns which may not exist yet.
 *
 * Several `products` columns land in migrations that deploy separately from the
 * code that writes them (status / available_from / pre_order_eta /
 * ai_instructions / delivery_note / attributes). The API therefore keeps them in
 * a side-bag and retries the write when the DB rejects an unknown column.
 *
 * The retry used to drop the WHOLE bag. That was survivable while every column
 * in it was already deployed, but the moment one new column joined, a single
 * missing column started discarding five working ones — a broker marking a sold
 * flat «Зогссон» got a 200 back and a listing that was still `active`, so the AI
 * kept offering it. This module drops **only the column the database actually
 * named**, and reports what it dropped so the caller can warn the user.
 */

export interface WriteResult<T> {
    data: T | null;
    error: { message?: string; code?: string } | null;
    /** Optional columns removed to make the write succeed (deploy lag). */
    droppedColumns: string[];
}

interface DbError {
    message?: string;
    code?: string;
}

/** Does this error mean "the payload named a column I don't have"? */
export function isMissingColumnError(error: DbError | null | undefined): boolean {
    if (!error) return false;
    const msg = error.message || '';
    return (
        error.code === 'PGRST204' ||
        /column .+ does not exist/i.test(msg) ||
        /could not find the .+ column/i.test(msg)
    );
}

/**
 * Pull the offending column name out of the error. Covers both the PostgREST
 * schema-cache wording and the raw Postgres one:
 *   "Could not find the 'attributes' column of 'products' in the schema cache"
 *   'column "attributes" of relation "products" does not exist'
 * Returns null when the message is shaped differently, which the caller treats
 * as "give up and drop everything optional".
 */
export function missingColumnName(error: DbError | null | undefined): string | null {
    const msg = error?.message || '';
    const patterns = [
        /could not find the '([^']+)' column/i,
        /could not find the "([^"]+)" column/i,
        /column "([^"]+)" of relation/i,
        /column ([a-z0-9_]+) of relation/i,
        /column "([^"]+)" does not exist/i,
    ];
    for (const re of patterns) {
        const m = msg.match(re);
        // PostgREST sometimes qualifies the name as `products.attributes`.
        if (m?.[1]) return m[1].split('.').pop() ?? m[1];
    }
    return null;
}

/**
 * Run `write(base + extras)`, and on a missing-column error remove just that one
 * key from `extras` and try again, until the write succeeds or `extras` is empty.
 *
 * `write` is called with the merged payload and must perform one round trip.
 * The loop is bounded by the number of optional keys, so it cannot spin.
 */
export async function writeWithOptionalColumns<T>(
    write: (payload: Record<string, unknown>) => Promise<{ data: T | null; error: DbError | null }>,
    base: Record<string, unknown>,
    extras: Record<string, unknown>,
): Promise<WriteResult<T>> {
    const remaining: Record<string, unknown> = { ...extras };
    const droppedColumns: string[] = [];
    // +1 so the final attempt with an empty bag still runs.
    const maxAttempts = Object.keys(remaining).length + 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data, error } = await write({ ...base, ...remaining });

        if (!isMissingColumnError(error) || Object.keys(remaining).length === 0) {
            return { data, error, droppedColumns };
        }

        const column = missingColumnName(error);
        if (column && column in remaining) {
            delete remaining[column];
            droppedColumns.push(column);
        } else {
            // Unrecognised wording — fall back to the old all-or-nothing
            // behaviour rather than looping on an error we can't act on.
            droppedColumns.push(...Object.keys(remaining));
            for (const key of Object.keys(remaining)) delete remaining[key];
        }
    }

    // Unreachable in practice: the loop returns as soon as the error is not a
    // missing-column one, and `remaining` shrinks every iteration.
    return { data: null, error: { message: 'writeWithOptionalColumns: exhausted retries' }, droppedColumns };
}
