# Meta App Review — Instagram Login flow

This is a **separate** App Review submission from the existing 2026-03-14
Facebook-Login submission. The Instagram-product app is a distinct app in
the Meta Developer Dashboard with its own client ID, scopes, and webhook
configuration.

## Why a second submission

The existing review covered FB-Login flow scopes:

- `instagram_basic`
- `instagram_manage_messages`
- `pages_show_list`
- `pages_messaging`
- `pages_manage_metadata`
- `public_profile`

These permissions only work for Instagram Business accounts that are
linked to a Facebook Page. A significant portion of Mongolian SMB shops
operate Instagram-only without a Facebook Page — Meta's 2024 "Instagram
API with Instagram Login" is the supported path for them.

## Scopes to submit

- `instagram_business_basic` — read profile, account_type, follower_count
- `instagram_business_manage_messages` — receive DMs, send replies
- `instagram_business_manage_comments` — receive comments, send replies

## Use case (English — paste into the App Review form)

> Syncly (https://www.syncly.mn) is an AI-powered social commerce platform
> serving small e-commerce shops in Mongolia. Many of these shops operate
> Instagram-only — they do not maintain a Facebook Page. We use the
> Instagram Login flow so these shops can connect their Instagram Business
> or Creator account directly. With `instagram_business_manage_messages` an
> AI sales agent answers customer DMs (product questions, price, stock,
> delivery). With `instagram_business_manage_comments` the AI responds to
> public comments on the shop's posts. All replies are sent only in
> response to customer-initiated messages or comments.

## Screencast checklist

The screencast must demonstrate end-to-end flow with a Business or Creator
Instagram account that **has no Facebook Page connection**:

1. Show the IG account in Instagram → Settings → Linked Accounts (no FB Page listed)
2. In Syncly settings, click **"Шууд Instagram-р"** (the IG-Login button)
3. Show the Instagram OAuth consent screen with the requested permissions
4. Show successful return to Syncly with the IG account connected
5. Send a DM from a different IG account → show the AI reply arriving
6. Comment on a Reel → show the AI reply
7. Disconnect → show the connection cleared

## Webhook configuration (Meta dashboard, NOT code)

Under the **Instagram** product (not Messenger):

- **Callback URL:** `https://www.syncly.mn/api/webhook`
- **Verify Token:** `process.env.FACEBOOK_VERIFY_TOKEN` (same shared secret)
- **Subscription fields:**
  - `messages`
  - `messaging_postbacks`
  - `comments`

Webhook signature verification uses `INSTAGRAM_APP_SECRET`. The webhook
handler at `src/app/api/webhook/route.ts:46-77` already tries both
`FACEBOOK_APP_SECRET` and `INSTAGRAM_APP_SECRET`, so no code change is
needed when this submission goes Live.

## Code references for review

| Concern | File |
|---------|------|
| OAuth start (Instagram-direct) | `src/app/api/auth/instagram-login/route.ts` |
| OAuth callback (token exchange + DB save) | `src/app/api/auth/instagram-login/callback/route.ts` |
| Auth flow discriminator | `shops.instagram_auth_type` (migration `20260506100000_instagram_login_auth_type.sql`) |
| Send-message host switch | `src/lib/facebook/messenger.ts` (`graphBaseUrl`) |
| Webhook signature & routing | `src/app/api/webhook/route.ts` |
| 60-day token refresh | `src/app/api/cron/refresh-instagram-tokens/route.ts` |
| Settings UI (twin-button card) | `src/app/dashboard/settings/page.tsx` (Instagram block ≈ line 716) |
| Setup wizard UI | `src/components/setup/InstagramStep.tsx` |

## Deployment checklist (do this before submission)

- [ ] `INSTAGRAM_APP_ID` env var set on Vercel (production + preview)
- [ ] `INSTAGRAM_APP_SECRET` confirmed (already used for webhook signing)
- [ ] Migration `20260506100000_instagram_login_auth_type.sql` applied to production Supabase
- [ ] Production redirect URI `https://www.syncly.mn/api/auth/instagram-login/callback` added in Meta dashboard → Instagram product → OAuth settings
- [ ] Test User added in Meta dashboard so the screencast can be recorded against a real BUSINESS / CREATOR account that has no FB Page
- [ ] Cron schedule confirmed in `vercel.json` (`0 3 * * *`)

## Known limitations to surface in the submission

- Instagram Login does not support the Sender Action API (`mark_seen`,
  `typing_on`) — these are silently skipped in messenger.ts
- IG Login API uses generic templates only; Messenger postback buttons
  may need conversion to quick replies for IG-Login shops
- Personal Instagram accounts are rejected at the callback
  (`personal_account_unsupported`); the UI prompts the user to convert
  to Business or Creator first
