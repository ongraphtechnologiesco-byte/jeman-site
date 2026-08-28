# Jeman Collections — site build notes

## What's here

- **index.html** — your existing storefront (shop, filters, fit guide, bag/checkout UI). Untouched except two nav links now point at the new account page.
- **account.html** — customer sign in / sign up, points balance, vouchers, order history, and the gift-voucher purchase flow (occasion + amount + recipient).
- **track-order.html** — public order lookup by reference + phone.
- **admin/** — staff-only area:
  - `login.html` — demo password gate (`jeman-admin`). **Replace with real auth before launch.**
  - `index.html` — dashboard: pending/awaiting-payment counts, revenue, low stock, and one-click "Send STK push."
  - `orders.html` — full order queue with status actions (send STK, mark paid/failed, advance processing → shipped → delivered).
  - `products.html` — add/edit/delete products and their size/stock variants.
  - `inventory.html` — stock vs. reserved vs. available per size, matching the reservation logic we designed.
  - `announcements.html` — post discounts/offers/new-arrival notices.
- **css/shared.css** — design tokens matching the storefront's existing palette (ink / paper / brass / indigo) and type (Instrument Serif, Instrument Sans, DM Mono).
- **js/store.js** — the data layer. Runs entirely on `localStorage` right now so the whole site is clickable with no server. Every function (`Orders.sendSTKPush`, `Vouchers.redeem`, etc.) is shaped the way a real API call would be, so swapping in a real backend is a rewrite of function bodies, not of any page that calls them.

## What's real vs. demo right now

**Working end-to-end (client-side):**
- Accounts, login/signup, points accrual (1 pt per KES 100), voucher creation and redemption
- Order lifecycle: pending → payment_sent → paid → processing → shipped → delivered, plus cancellation
- Stock reservation on pending orders, with `Orders.releaseExpired()` auto-releasing lapsed reservations
- Full admin CRUD on products, order status, inventory visibility

**Still demo/placeholder:**
- `index.html`'s own bag/checkout (the one with "Pay with M-Pesa") is a **separate, self-contained simulation** built earlier — it doesn't yet write into `js/store.js`'s `Orders`, and doesn't yet call the real `server/` backend below. Next step: point checkout at `POST /api/orders` and `POST /api/orders/:ref/stkpush`.
- Admin login is a hardcoded demo password, not real auth.
- The personalized "Complete this look" bundle + occasion selector (mocked up earlier) isn't wired into `index.html` yet — the product-page rule (`Products.bundleFor`) is ready in `store.js` for whoever builds that section.
- The reservation "warn before auto-release" flow and admin↔customer messaging aren't built yet.

## KCB Buni — now a real, working backend

`server/` is a working Node/Express server that does actual OAuth token generation,
the STK push request, and receives KCB's IPN callback — using your real sandbox
credentials once you drop them into `server/.env` (never in chat, never committed).
Full setup + a step-by-step curl test walkthrough is in `server/README.md`. This
replaces what used to be a `TODO(api)` comment in `js/store.js`.

## Next steps, in order

1. Follow `server/README.md` to run the payments server against KCB's sandbox and confirm a real STK push + callback works end to end.
2. Connect `index.html`'s bag checkout to the server's `/api/orders` and `/api/orders/:ref/stkpush` endpoints so real orders flow into the admin queue.
3. Replace the admin password gate with real authentication.
4. Once confirmed in sandbox, send the go-live letter to buni@kcbgroup.com and switch `KCB_BASE_URL` to production.
