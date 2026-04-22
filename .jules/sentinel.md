## 2024-05-24 - Missing CSRF in Instagram OAuth Flow
**Vulnerability:** The Instagram OAuth flow lacked a CSRF state validation, meaning an attacker could craft a connection request to tie their Instagram business account to a victim's shop without the victim's consent.
**Learning:** The Facebook OAuth flow had CSRF protection using an `httpOnly` cookie (`fb_oauth_state`), but the Instagram OAuth implementation passed state (source and shopId) without appending a secret random token and verifying it upon callback.
**Prevention:** Always verify OAuth callbacks using state tokens securely stored in `httpOnly` cookies, even when extending or re-using similar identity provider endpoints (like Meta's Graph API used for both FB and IG).
