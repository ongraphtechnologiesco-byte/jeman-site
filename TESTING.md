# Testing checklist — run this once published (PUBLISHING.md)

Work through these in order. Each builds on the last, so if one fails, fix it
before moving to the next rather than skipping ahead.

## 1. Backend alone
- [ ] Visit `https://your-render-url.onrender.com/api/orders` in a browser —
      you should get a 401 (correct — this route needs an admin token)
- [ ] From Render's logs, confirm no crash/error messages on startup

## 2. Admin login
- [ ] Go to `your-site/admin/login.html`
- [ ] Wrong password → clear error message, not a blank failure
- [ ] Correct password → lands on the dashboard

## 3. Place a real order (as a customer)
- [ ] Browse the storefront, add an item to the bag
- [ ] Go to checkout, enter **your own phone number**
- [ ] Confirm an order reference is shown
- [ ] Go to `admin/orders.html` and confirm the same order appears as "pending"

## 4. Send a real payment request
- [ ] From the admin dashboard or orders page, click "Send STK push" on that order
- [ ] Your phone should receive an actual M-Pesa prompt within a few seconds
- [ ] If nothing arrives: check Render's logs for the exact error from KCB —
      common causes are a wrong shortcode, unapproved sandbox test number, or
      a typo in `KCB_CONSUMER_KEY`/`SECRET`

## 5. Complete the payment
- [ ] Enter your M-Pesa PIN
- [ ] Within a few seconds, the order should flip to "paid" — check both the
      admin orders page and `track-order.html` (using your reference + phone)
- [ ] Confirm a real M-Pesa receipt number shows on the order, not a placeholder

## 6. Order tracking as a customer
- [ ] Go to `track-order.html`, enter your reference and phone
- [ ] Confirm the status bar reflects "Paid"
- [ ] Send a message in the thread — confirm it appears

## 7. Admin replies to the message
- [ ] From `admin/orders.html`, open the message thread for that order
- [ ] Reply — confirm it shows up when you refresh `track-order.html` as the customer

## 8. Advance the order manually (demo-mode action, since live mode has no "mark shipped" UI yet)
- [ ] Currently: once paid, further status changes (processing/shipped/delivered)
      need to be added to the admin UI for live mode, or done directly via the
      `PATCH`-style pattern in `server.js` — this is a small gap worth closing
      before relying on it day-to-day. Flag it back to me if you want it built.

## 9. Reservation expiry
- [ ] Place a second test order and don't pay it
- [ ] Confirm it shows as "pending" in admin with no urgency yet
- [ ] (Faster test: manually edit `reserveUntil` in the backend to a past time,
      or just trust the 24-hour default and check back tomorrow)

## 10. Accounts, points, and vouchers
- [ ] Sign up for an account, note these currently run in local demo mode
      (points/vouchers aren't yet connected to the live backend — see README
      "Still demo/placeholder")

## If something fails
Note exactly which numbered step failed and what you saw (error message,
blank screen, wrong status) — that's the fastest way for me to help you fix it.
