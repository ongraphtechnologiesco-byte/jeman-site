# Publishing Jeman — free, temporary hosting for testing

You said you'll pay for a real domain and hosting later. Good news: you can get
this fully live on the internet today, for free, using temporary URLs — enough
to run real end-to-end tests (including real KCB payments) before spending
anything. Swapping in your real domain later is a small config change, not a rebuild.

Two separate things need hosting:
- **The static site** (everything except `server/`) — just HTML/CSS/JS files
- **The backend** (`server/`) — needs to actually run Node.js continuously

## Part 1 — Publish the backend (server/)

**Render.com** has a free tier that runs Node servers. (Railway.app is a good alternative if you prefer.)

1. Push the `server/` folder to a GitHub repo (create a free GitHub account if needed).
   **Do not commit your `.env` file** — it's already in `.gitignore`.
2. Go to render.com → New → Web Service → connect your GitHub repo.
3. Settings:
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
4. Under "Environment," add each variable from `server/.env.example` with your real values:
   `KCB_CONSUMER_KEY`, `KCB_CONSUMER_SECRET`, `KCB_ORG_SHORTCODE`, `KCB_ORG_PASSKEY`,
   `KCB_BASE_URL` (keep as sandbox for now), `ADMIN_PASSWORD` (pick a real one),
   `ALLOWED_ORIGINS` (fill in after Part 2, once you know your static site's URL).
5. For `CALLBACK_BASE_URL`, use the URL Render gives your service once deployed
   (something like `https://jeman-payments.onrender.com`) — **no trailing slash**.
6. Deploy. Render will show logs — confirm you see "Jeman payments server running."

## Part 2 — Publish the static site

**Netlify** is the simplest option for this.

1. Go to netlify.com → Add new site → deploy manually, and drag in every file/folder
   **except** `server/` (index.html, account.html, track-order.html, css/, js/, admin/).
2. Netlify gives you a URL like `https://random-name-123.netlify.app`.
3. Open `js/config.js` and set:
   ```js
   window.JEMAN_API_BASE_URL = "https://jeman-payments.onrender.com";
   ```
   (your actual Render URL from Part 1). Re-deploy to Netlify with this change.
4. Go back to Render, update `ALLOWED_ORIGINS` to your Netlify URL, and redeploy.

## Part 3 — Point KCB at your live callback URL

KCB needs to reach your backend to deliver payment confirmations. Once Part 1 is
deployed, your callback URL is:
```
https://jeman-payments.onrender.com/api/mpesa/callback
```
This is already what `CALLBACK_BASE_URL` in your Render environment produces —
nothing extra to configure here, just confirm it's correct in the STK push
request your server sends (check Render's logs after a test push).

## What you'll have after this

- A real, working URL to send to friends/family to click through and test
- Real KCB sandbox payments working end to end
- Everything free, nothing tied to a domain you haven't bought yet

## Moving to your real domain later

When you buy your domain and hosting: redeploy the static files there, redeploy
`server/` wherever you're hosting it long-term (Render's free tier sleeps when
idle — fine for testing, not for a live store), update `js/config.js` with the
new backend URL, and update `ALLOWED_ORIGINS` and `CALLBACK_BASE_URL` to match.
Everything else stays exactly the same.
