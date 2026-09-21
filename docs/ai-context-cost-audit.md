# Syncly AI context cost audit

Measured: 2026-09-21. Model: `gemini-3.1-flash-lite`. Measurements were taken before deployment; production savings must be measured after rollout.

## Measured results

The same live ITOH shop snapshot, Enterprise settings, plan/role tool declarations and synthetic questions were sent to Gemini before and after. No customer messages, cart or customer memory were included. No orders, messages to customers, or database writes were performed. These are API token measurements, not production invoice savings.

| Question | Input before | Input after | Reduction | API calls before/after |
|---|---:|---:|---:|---:|
| greeting | 20,664 | 12,848 | 37.8% | 1/1 |
| price | 20,682 | 13,374 | 35.3% | 1/1 |
| details | 20,707 | 13,399 | 35.3% | 1/1 |

Across these three equally weighted cases: input 62,053 → 39,621 (36.1% lower); output 386 → 398.
At Standard uncached text rates ($0.25/M input, $1.50/M output), the sample costs approximately $0.01609 → $0.01050 (34.7% lower). This is an estimate; cache, thinking tokens, other tools, retries and the actual traffic mix can change the invoice. Pricing: https://ai.google.dev/gemini-api/docs/pricing

The separate shop named Syncly has no active products. Its first request remains 8,035 tokens. The lookup tool is not added when it is unnecessary. This change targets catalog overhead; it is not a universal percentage reduction.

## Implementation

- Descriptions longer than 500 characters get a 160-character preview. Price, inventory, variants, delivery, owner instructions and business rules stay intact.
- An explicitly named product gets its complete description immediately when it fits a 4,000-character page. This avoided an additional API call in the price/details cases.
- Other details are available through a read-only, shop-scoped `get_product_details` tool with bounded pages and validated offsets. Draft/discontinued and foreign-shop IDs are rejected. It does not grant transactional permissions.
- Full-context behavior remains available to callers without the lookup tool.
- Per-call production telemetry records shop ID, model, prompt/output/cached/total tokens and call ordinal. It does not log prompt text or customer data. Previously success/info token logs were disabled in production.
- Removed 170 lines of unused legacy prompt strings. This simplifies code; it does not itself reduce API tokens because those strings were never sent.

## Verification and limits

- 100 targeted tests: catalog preservation, paging, shop isolation, router lookup integration, existing order tool dispatch and prompt behavior.
- TypeScript, focused ESLint and diff whitespace checks pass.
- Six live generations (three before, three after) returned Mongolian responses. Both price responses quoted 34,000 MNT. Details responses retained the source usage facts. This is a limited smoke test, not a full quality or medical-accuracy evaluation.
- Read-only lookup was additionally exercised live during the initial experiment and through router integration tests. Pure lookup can require an extra API request and can cost more on a details-heavy conversation. Exact-name prefetch reduces this risk, but ambiguous references still use the tool.
- No hard input cap or history truncation was introduced: customer/order context and safety rules are preserved. The observed after prompt still exceeds 8,000 tokens with Enterprise rules and tools.
- The local database configuration was used to read the shop snapshot. Production billing routing and invoice totals were not changed or independently reconciled.

## Reproduce

```sh
node scripts/measure-ai-context.cjs SHOP_ID
node scripts/measure-ai-context.cjs SHOP_ID --live
```

Uses `.env.local` privately. The first command reads the shop and calls Gemini countTokens; `--live` also generates synthetic test replies, executing only the read-only product-description tool. Output includes responses for manual review. `ai-context-measurements.json` stores the numeric results without generated response text.
