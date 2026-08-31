/**
 * Lead stage markers for the `lead` dashboard archetype (үл хөдлөх / авто,
 * сургалт) — shops whose AI agent has `lead_capture` but no `sales`.
 *
 * WHY TAGS: a broker never creates an `orders` row — there is no checkout for an
 * apartment — so `customers.total_orders` is pinned at 0 forever. Every
 * "converted" number on the lead dashboard and in the lead report was derived
 * from it, which made them structurally impossible to move: a broker could close
 * ten deals and still read "Хөрвүүлсэн 0 / Хөрвүүлэлт 0%".
 *
 * `customers.tags` is JSONB, already editable end-to-end (the customers page
 * writes it through PATCH /api/dashboard/customers) and already GIN-indexed, so
 * it can carry the stage today with no migration. When a real `leads` table
 * lands, these constants are the single place that has to change.
 */

/** The stage a broker moves a lead through, in pipeline order. */
export const LEAD_STAGE_TAGS = [
    'Холбогдсон',
    'Үзлэг',
    'Хэлэлцээр',
    'Хөрвүүлсэн',
    'Татгалзсан',
] as const;

export type LeadStageTag = (typeof LEAD_STAGE_TAGS)[number];

/** Won — the deal closed. This is what "Хөрвүүлсэн" counts. */
export const LEAD_WON_TAG: LeadStageTag = 'Хөрвүүлсэн';

/** Lost — the prospect said no. Leaves the pipeline without counting as won. */
export const LEAD_LOST_TAG: LeadStageTag = 'Татгалзсан';

function toTagList(tags: unknown): string[] {
    return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : [];
}

/** Did this lead close? */
export function isWonLead(tags: unknown): boolean {
    return toTagList(tags).includes(LEAD_WON_TAG);
}

/**
 * Is this lead finished either way? A closed lead must drop out of the
 * follow-up queue — otherwise the queue only ever grows and the broker sees the
 * same names after they have already been dealt with.
 */
export function isClosedLead(tags: unknown): boolean {
    const list = toTagList(tags);
    return list.includes(LEAD_WON_TAG) || list.includes(LEAD_LOST_TAG);
}
