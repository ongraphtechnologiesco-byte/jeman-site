/* ============================================================
   JEMAN — payments backend
   ------------------------------------------------------------
   Talks to KCB Buni on the server so your Consumer Key/Secret
   never reach the browser. Orders are persisted to a small JSON
   file for now (data/orders.json) — swap readOrders/writeOrders
   for real database calls when you're ready; every other
   function stays the same.

   Endpoints:
     POST /api/orders                 create an order (status: pending)
     POST /api/orders/:ref/stkpush    admin clicks "send payment request"
     POST /api/mpesa/callback         KCB's IPN hits this after payment
     GET  /api/orders                 admin order list
     GET  /api/orders/:ref            customer order tracking (needs ?phone=)
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const {
  KCB_CONSUMER_KEY,
  KCB_CONSUMER_SECRET,
  KCB_ORG_SHORTCODE,
  KCB_ORG_PASSKEY,
  KCB_BASE_URL,
  CALLBACK_BASE_URL,
  PORT,
  ALLOWED_ORIGINS
} = process.env;

if (!KCB_CONSUMER_KEY || !KCB_CONSUMER_SECRET || !KCB_ORG_SHORTCODE) {
  console.warn('⚠️  KCB credentials are not fully set in .env — STK push calls will fail until they are.');
}

const app = express();
app.use(express.json());
app.use(cors({
  origin: (ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
}));

/* ---------- tiny file-backed order store ---------- */
const DB_PATH = path.join(__dirname, 'data', 'orders.json');
function readOrders() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) { return []; }
}
function writeOrders(list) {
  fs.writeFileSync(DB_PATH, JSON.stringify(list, null, 2));
}

/* ---------- KCB OAuth token, cached until it expires ---------- */
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const basicAuth = Buffer.from(`${KCB_CONSUMER_KEY}:${KCB_CONSUMER_SECRET}`).toString('base64');
  const resp = await axios.post(
    `${KCB_BASE_URL}/token?grant_type=client_credentials`,
    null,
    { headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  cachedToken = resp.data.access_token;
  // refresh a little early so we never use an expired token mid-request
  tokenExpiresAt = Date.now() + (Number(resp.data.expires_in || 3599) - 60) * 1000;
  return cachedToken;
}

/* ---------- normalize a Kenyan number to 2547XXXXXXXX ---------- */
function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  return digits;
}

/* ============================================================
   POST /api/orders — create a pending order
   ============================================================ */
app.post('/api/orders', (req, res) => {
  const { items, address, phone, subtotal, discount = 0 } = req.body;
  if (!items || !items.length || !phone) {
    return res.status(400).json({ error: 'items and phone are required' });
  }
  const orders = readOrders();
  const order = {
    ref: 'JM' + Date.now().toString().slice(-8),
    items, address, phone,
    subtotal, discount,
    total: Math.max(0, (subtotal || 0) - discount),
    status: 'pending',
    createdAt: new Date().toISOString(),
    reserveUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    merchantRequestId: null,
    checkoutRequestId: null,
    mpesaReceipt: null,
    history: [{ status: 'pending', at: new Date().toISOString() }]
  };
  orders.push(order);
  writeOrders(orders);
  res.json(order);
});

/* ============================================================
   POST /api/orders/:ref/stkpush — admin sends the payment prompt
   ============================================================ */
app.post('/api/orders/:ref/stkpush', async (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.ref === req.params.ref);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'pending') return res.status(400).json({ error: `Order is already ${order.status}` });

  try {
    const token = await getAccessToken();
    const payload = {
      phoneNumber: normalizePhone(order.phone),
      amount: String(order.total),
      invoiceNumber: order.ref,
      sharedShortCode: true,
      orgShortCode: KCB_ORG_SHORTCODE,
      orgPassKey: KCB_ORG_PASSKEY || '',
      callbackUrl: `${CALLBACK_BASE_URL}/api/mpesa/callback`,
      transactionDescription: `Jeman order ${order.ref}`
    };

    const resp = await axios.post(
      `${KCB_BASE_URL}/mm/api/request/1.0.0/stkpush`,
      payload,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    const body = resp.data.response || {};
    if (body.ResponseCode !== '0') {
      return res.status(502).json({ error: body.ResponseDescription || 'STK push was not accepted', raw: resp.data });
    }

    order.status = 'payment_sent';
    order.merchantRequestId = body.MerchantRequestID;
    order.checkoutRequestId = body.CheckoutRequestID;
    order.history.push({ status: 'payment_sent', at: new Date().toISOString() });
    writeOrders(orders);

    res.json({ ok: true, order });
  } catch (err) {
    console.error('STK push failed:', err.response?.data || err.message);
    res.status(502).json({ error: 'Could not reach KCB Buni', detail: err.response?.data || err.message });
  }
});

/* ============================================================
   POST /api/mpesa/callback — KCB's IPN after the customer pays
   ============================================================ */
app.post('/api/mpesa/callback', (req, res) => {
  console.log('IPN received:', JSON.stringify(req.body));
  const callback = req.body?.Body?.stkCallback;
  if (!callback) return res.status(200).json({ received: true }); // ack anyway so KCB doesn't retry forever

  const orders = readOrders();
  const order = orders.find(o => o.checkoutRequestId === callback.CheckoutRequestID);
  if (!order) {
    console.warn('IPN for unknown CheckoutRequestID:', callback.CheckoutRequestID);
    return res.status(200).json({ received: true });
  }

  if (callback.ResultCode === 0) {
    const items = (callback.CallbackMetadata?.Item) || [];
    const get = name => items.find(i => i.Name === name)?.Value;
    order.status = 'paid';
    order.mpesaReceipt = get('MpesaReceiptNumber') || null;
    order.paidAmount = get('Amount') || order.total;
    order.history.push({ status: 'paid', at: new Date().toISOString() });
    // TODO: award loyalty points and redeem any voucher here, same rule as js/store.js Orders.updateStatus('paid')
  } else {
    order.status = 'cancelled';
    order.history.push({ status: 'cancelled', at: new Date().toISOString(), reason: callback.ResultDesc });
  }
  writeOrders(orders);
  res.status(200).json({ received: true });
});

/* ============================================================
   Read endpoints
   ============================================================ */
app.get('/api/orders', (req, res) => res.json(readOrders()));

app.get('/api/orders/:ref', (req, res) => {
  const order = readOrders().find(o => o.ref === req.params.ref);
  if (!order) return res.status(404).json({ error: 'Not found' });
  if (req.query.phone && normalizePhone(req.query.phone) !== normalizePhone(order.phone)) {
    return res.status(403).json({ error: 'Phone number does not match this order' });
  }
  res.json(order);
});

app.listen(PORT || 4000, () => {
  console.log(`Jeman payments server running on port ${PORT || 4000}`);
  console.log(`KCB base URL: ${KCB_BASE_URL}`);
  console.log(`Callback URL KCB will hit: ${CALLBACK_BASE_URL}/api/mpesa/callback`);
});
