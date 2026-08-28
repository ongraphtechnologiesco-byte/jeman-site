# Jeman payments server — setup

This is the piece that actually talks to KCB Buni. It's separate from the static
storefront on purpose: your Consumer Key/Secret must live on a server, never in
browser code, or anyone viewing the page source could see them.

## 1. Install

```bash
cd server
npm install
```

## 2. Configure your credentials — locally, never in chat

```bash
cp .env.example .env
```

Open `.env` and fill in the values from your KCB Buni onboarding email:
- `KCB_CONSUMER_KEY`
- `KCB_CONSUMER_SECRET`
- `KCB_ORG_SHORTCODE` (your paybill/till number)
- `KCB_ORG_PASSKEY` (usually leave blank — KCB will tell you if you need one)

Leave `KCB_BASE_URL` as the sandbox (`uat.buni.kcbgroup.com`) until you've tested
end-to-end and sent the go-live letter to buni@kcbgroup.com.

**`.env` is already in `.gitignore`. Never commit it, never paste its contents
anywhere outside your own machine/server.**

## 3. Expose your callback URL for sandbox testing

KCB needs to reach `CALLBACK_BASE_URL` from the internet — your laptop's
`localhost` isn't reachable by them. Use a tunnel while testing:

```bash
npx tunnelmole 4000
# or: ngrok http 4000
```

Copy the HTTPS URL it gives you into `.env` as `CALLBACK_BASE_URL` (no trailing slash).

## 4. Run it

```bash
npm start
```

You should see:
```
Jeman payments server running on port 4000
KCB base URL: https://uat.buni.kcbgroup.com
Callback URL KCB will hit: https://your-tunnel-url/api/mpesa/callback
```

## 5. Test the flow

```bash
# 1. Create an order
curl -X POST http://localhost:4000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"p1","size":"M","qty":1,"price":2450}],"subtotal":2450,"phone":"0722000000"}'

# copy the "ref" from the response, e.g. JM12345678

# 2. Trigger the STK push (use a real Safaricom number you can access in sandbox)
curl -X POST http://localhost:4000/api/orders/JM12345678/stkpush

# 3. Check your phone for the prompt, enter your PIN
# 4. Watch the server console — the IPN callback should log and the order flips to "paid"

# 5. Confirm
curl http://localhost:4000/api/orders/JM12345678
```

## 6. Wire it to the site

Right now `js/store.js` on the frontend still simulates payment locally. To connect
it for real, point `Orders.sendSTKPush()` and order creation at this server's
endpoints (`POST /api/orders`, `POST /api/orders/:ref/stkpush`) instead of the
local mock — the function names and shapes were designed to make this swap small.
Set `ALLOWED_ORIGINS` in `.env` to wherever the storefront is actually hosted.

## 7. Going live

Once sandbox testing works end-to-end:
1. Deploy this server somewhere with a real HTTPS domain (Render, Railway, a small VPS — anywhere Node runs).
2. Update `CALLBACK_BASE_URL` and `KCB_BASE_URL` (switch to production) in your deployed `.env`.
3. Send the signed go-live request letter to **buni@kcbgroup.com** to move off sandbox.
4. Update `ALLOWED_ORIGINS` to your real storefront domain.
