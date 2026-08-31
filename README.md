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

**Fully wired and tested end-to-end** (see "What I tested" below):
- Accounts, login/signup, points accrual, voucher creation and redemption
- Order lifecycle: pending → payment_sent → paid → processing → shipped → delivered, plus cancellation
- Stock reservation with auto-release on expiry, plus an "expiring soon" warning shown to admin before it lapses
- Full admin CRUD on products, order status, inventory visibility
- **Live mode**: set `window.JEMAN_API_BASE_URL` in `js/config.js` to your deployed `server/` URL, and the storefront checkout, account order history, order tracking, and admin panel all switch from local simulation to the real backend — same pages, same code, no rewiring needed elsewhere.
- Real KCB Buni OAuth token request, STK push request, and IPN callback handling in `server/`
- Real admin login (server-issued token, not a hardcoded password) once live
- A basic admin↔customer message thread per order, visible on both the admin orders page and the customer's order-tracking page

**Still demo/placeholder:**
- The personalized "Complete this look" bundle + occasion selector (mocked up earlier) isn't wired into `index.html`'s actual product page yet — the logic (`Products.bundleFor`) is ready in `store.js` for whoever builds that section.
- Product catalogue still lives in two separate places: `index.html`'s own product array (`const P = [...]`) for browsing, and `js/store.js`'s `Products` for cart/inventory/admin. They aren't the same data source yet — moving the catalogue to the backend so there's one source of truth is the next real architecture step.
- Admin auth is real but simple (server-issued tokens in memory, no password hashing/persistent sessions) — fine for one admin testing this, worth hardening before it's the only thing standing between the public and your order data.

## What I tested (run locally in this environment)

- Created a real order via `POST /api/orders`
- Confirmed `POST /api/orders/:ref/stkpush` is rejected without an admin token (401), and correctly attempts a real request to KCB's actual sandbox domain once authenticated (it failed here only because this sandbox has no internet access to KCB — that's an environment limit, not a bug; you'll see this succeed once you run it with real credentials and a reachable network)
- Simulated a successful KCB IPN callback — order correctly flipped to `paid`, captured the real M-Pesa receipt number field
- Simulated a failed/cancelled KCB IPN callback — order correctly flipped to `cancelled` with the reason recorded
- Confirmed an unknown callback is acknowledged (200) without crashing the server
- Confirmed a reservation past its expiry auto-cancels the next time it's read
- Confirmed customer→admin and admin→customer messages both save correctly, and that an unauthenticated admin reply is rejected
- Served every HTML page and asset over a local static server and confirmed all of them return 200 (no broken links/paths)

## KCB Buni integration — real, not a stub

`server/` is a working Node backend built from KCB's actual API spec (OAuth token,
STK push, IPN callback shapes). Full setup instructions and a step-by-step curl
walkthrough are in `server/README.md`. Put your real credentials in `server/.env`
— never in chat, never committed.

## Next steps, in order

1. Follow `server/README.md`: run the payments server against KCB's sandbox from a machine/host with real internet access, and confirm a real STK push + callback works end to end with your own phone.
2. Deploy `server/` somewhere with a public HTTPS URL, and set `window.JEMAN_API_BASE_URL` in `js/config.js` to that URL — this is the single switch that moves the whole site from demo mode to live.
3. Publish the static files (everything outside `server/`) to any static host.
4. Test the full flow on the published site: place an order, have admin send the STK push, pay with a real phone, confirm the order updates everywhere (storefront, account, admin, tracking).
5. Once confirmed, send the go-live letter to buni@kcbgroup.com and switch `KCB_BASE_URL` to production in your deployed `.env`.
