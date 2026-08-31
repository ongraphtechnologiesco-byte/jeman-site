/* ============================================================
   JEMAN — shared store / mock backend
   -----------------------------------------------------------
   Everything here runs on localStorage so the whole site is
   clickable and demoable with NO server yet. Every function is
   written the way a real API call would be shaped, so swapping
   localStorage for fetch() calls to a real backend later is a
   rewrite of the function bodies only — not of any page that
   calls them.

   Search "TODO(api)" for every spot that becomes a real
   network call once there's a backend + KCB Buni integration.
   ============================================================ */

const JEMAN_KEYS = {
  products: "jeman_products",
  users: "jeman_users",
  session: "jeman_session",
  cart: "jeman_cart",
  orders: "jeman_orders",
  vouchers: "jeman_vouchers",
  reservationHours: 24
};

/* ---------- tiny helpers ---------- */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function uid(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 9); }
function money(n) { return "KES " + Number(n).toLocaleString("en-KE"); }
function nowISO() { return new Date().toISOString(); }
function addHours(date, h) { return new Date(new Date(date).getTime() + h * 3600 * 1000).toISOString(); }

/* ============================================================
   SEED DATA — replace with real catalogue via the admin panel
   ============================================================ */
const SEED_PRODUCTS = [
  { id: "p1", name: "The Poplin Shirt", category: "shirts", sub: "Formal", fit: "Slim",
    price: 2450, compareAt: null, occasions: ["work", "wedding"],
    variants: [
      { size: "S", stock: 4 }, { size: "M", stock: 9 }, { size: "L", stock: 6 }, { size: "XL", stock: 2 }
    ], tags: ["new"] },
  { id: "p2", name: "Linen Short Sleeve", category: "shirts", sub: "Linen", fit: "Regular",
    price: 2100, compareAt: 2600, occasions: ["casual", "birthday"],
    variants: [
      { size: "S", stock: 3 }, { size: "M", stock: 0 }, { size: "L", stock: 5 }, { size: "XL", stock: 4 }
    ], tags: ["sale"] },
  { id: "p3", name: "Tailored Chino", category: "trousers", sub: "Chino", fit: "Slim",
    price: 3100, compareAt: null, occasions: ["work", "casual"],
    variants: [
      { size: "30", stock: 5 }, { size: "32", stock: 8 }, { size: "34", stock: 6 }, { size: "36", stock: 3 }
    ], tags: [] },
  { id: "p4", name: "Merino Crewneck", category: "knitwear", sub: "Crewneck", fit: "Regular",
    price: 3600, compareAt: null, occasions: ["fathers-day", "casual"],
    variants: [
      { size: "S", stock: 2 }, { size: "M", stock: 6 }, { size: "L", stock: 5 }, { size: "XL", stock: 0 }
    ], tags: ["new"] },
  { id: "p5", name: "Structured Cap", category: "caps", sub: "Structured", fit: "One size",
    price: 1200, compareAt: null, occasions: ["birthday", "casual"],
    variants: [ { size: "One size", stock: 14 } ], tags: [] },
  { id: "p6", name: "Leather Belt", category: "trousers", sub: "Accessory", fit: "Regular",
    price: 1400, compareAt: null, occasions: ["work", "wedding"],
    variants: [ { size: "32", stock: 7 }, { size: "34", stock: 5 }, { size: "36", stock: 4 } ], tags: [] }
];

function seedIfEmpty() {
  if (!localStorage.getItem(JEMAN_KEYS.products)) writeJSON(JEMAN_KEYS.products, SEED_PRODUCTS);
  if (!localStorage.getItem(JEMAN_KEYS.users)) writeJSON(JEMAN_KEYS.users, []);
  if (!localStorage.getItem(JEMAN_KEYS.orders)) writeJSON(JEMAN_KEYS.orders, []);
  if (!localStorage.getItem(JEMAN_KEYS.vouchers)) writeJSON(JEMAN_KEYS.vouchers, []);
  if (!localStorage.getItem(JEMAN_KEYS.cart)) writeJSON(JEMAN_KEYS.cart, []);
}
seedIfEmpty();

/* ============================================================
   PRODUCTS
   ============================================================ */
const Products = {
  all() { return readJSON(JEMAN_KEYS.products, []); },
  get(id) { return this.all().find(p => p.id === id) || null; },
  save(product) {
    const list = this.all();
    const i = list.findIndex(p => p.id === product.id);
    if (i > -1) list[i] = product; else { product.id = product.id || uid("p"); list.push(product); }
    writeJSON(JEMAN_KEYS.products, list);
    return product;
  },
  remove(id) { writeJSON(JEMAN_KEYS.products, this.all().filter(p => p.id !== id)); },
  variant(productId, size) {
    const p = this.get(productId);
    return p ? p.variants.find(v => v.size === size) : null;
  },
  availableStock(productId, size) {
    const v = this.variant(productId, size);
    if (!v) return 0;
    const reserved = this.reservedQty(productId, size);
    return Math.max(0, v.stock - reserved);
  },
  reservedQty(productId, size) {
    const cutoff = Date.now();
    return Orders.all()
      .filter(o => ["pending", "payment_sent"].includes(o.status) && new Date(o.reserveUntil).getTime() > cutoff)
      .flatMap(o => o.items)
      .filter(it => it.productId === productId && it.size === size)
      .reduce((sum, it) => sum + it.qty, 0);
  },
  deductStock(productId, size, qty) {
    const list = this.all();
    const p = list.find(x => x.id === productId);
    const v = p && p.variants.find(x => x.size === size);
    if (v) { v.stock = Math.max(0, v.stock - qty); writeJSON(JEMAN_KEYS.products, list); }
  },
  bundleFor(product, occasion) {
    // Simple rules-based "complete the look" — same category exclusions,
    // biased toward the chosen occasion, but never hides the rest of the
    // catalogue. See README for how to extend this without narrowing choice.
    const others = this.all().filter(p => p.id !== product.id);
    const matches = others.filter(p => !occasion || occasion === "myself" || p.occasions.includes(occasion));
    const pool = matches.length >= 3 ? matches : others;
    return pool.slice(0, 3);
  }
};

/* ============================================================
   AUTH — TODO(api): replace with real signup/login + hashed
   passwords server-side. This is a DEMO ONLY mock.
   ============================================================ */
const Auth = {
  users() { return readJSON(JEMAN_KEYS.users, []); },
  signup({ name, phone, email, password }) {
    const users = this.users();
    if (users.find(u => u.phone === phone)) return { ok: false, error: "An account with this phone number already exists." };
    const user = { id: uid("u"), name, phone, email, password, points: 0, createdAt: nowISO() };
    users.push(user);
    writeJSON(JEMAN_KEYS.users, users);
    this.setSession(user.id);
    return { ok: true, user };
  },
  login({ phone, password }) {
    const user = this.users().find(u => u.phone === phone && u.password === password);
    if (!user) return { ok: false, error: "Phone number or password is incorrect." };
    this.setSession(user.id);
    return { ok: true, user };
  },
  logout() { localStorage.removeItem(JEMAN_KEYS.session); },
  setSession(userId) { localStorage.setItem(JEMAN_KEYS.session, userId); },
  currentUser() {
    const id = localStorage.getItem(JEMAN_KEYS.session);
    if (!id) return null;
    return this.users().find(u => u.id === id) || null;
  },
  updateUser(userId, patch) {
    const users = this.users();
    const i = users.findIndex(u => u.id === userId);
    if (i > -1) { users[i] = { ...users[i], ...patch }; writeJSON(JEMAN_KEYS.users, users); }
    return users[i];
  },
  addPoints(userId, pts) {
    const u = this.users().find(x => x.id === userId);
    if (u) this.updateUser(userId, { points: (u.points || 0) + pts });
  }
};

/* ============================================================
   CART
   ============================================================ */
const Cart = {
  get() { return readJSON(JEMAN_KEYS.cart, []); },
  add(productId, size, qty = 1) {
    const cart = this.get();
    const line = cart.find(l => l.productId === productId && l.size === size);
    if (line) line.qty += qty; else cart.push({ productId, size, qty });
    writeJSON(JEMAN_KEYS.cart, cart);
  },
  setQty(productId, size, qty) {
    let cart = this.get();
    if (qty <= 0) cart = cart.filter(l => !(l.productId === productId && l.size === size));
    else cart.forEach(l => { if (l.productId === productId && l.size === size) l.qty = qty; });
    writeJSON(JEMAN_KEYS.cart, cart);
  },
  remove(productId, size) { writeJSON(JEMAN_KEYS.cart, this.get().filter(l => !(l.productId === productId && l.size === size))); },
  clear() { writeJSON(JEMAN_KEYS.cart, []); },
  lines() {
    return this.get().map(l => {
      const p = Products.get(l.productId);
      return p ? { ...l, product: p, lineTotal: p.price * l.qty } : null;
    }).filter(Boolean);
  },
  count() { return this.get().reduce((s, l) => s + l.qty, 0); },
  subtotal() { return this.lines().reduce((s, l) => s + l.lineTotal, 0); }
};

/* ============================================================
   VOUCHERS — gift vouchers + discount codes, one system
   ============================================================ */
const Vouchers = {
  all() { return readJSON(JEMAN_KEYS.vouchers, []); },
  create({ type, amount, occasion, buyerUserId, recipientName, recipientContact, message }) {
    const v = {
      id: uid("v"), code: ("JEMAN-" + Math.random().toString(36).slice(2, 8)).toUpperCase(),
      type, amount, occasion: occasion || null, buyerUserId: buyerUserId || null,
      recipientName: recipientName || null, recipientContact: recipientContact || null,
      message: message || "", status: "active", createdAt: nowISO(), redeemedAt: null
    };
    const list = this.all(); list.push(v); writeJSON(JEMAN_KEYS.vouchers, list);
    return v;
    // TODO(api): trigger delivery — email / WhatsApp / SMS to recipientContact with the code + message
  },
  findByCode(code) { return this.all().find(v => v.code.toUpperCase() === code.toUpperCase()) || null; },
  redeem(code, amountUsed) {
    const list = this.all();
    const v = list.find(x => x.code.toUpperCase() === code.toUpperCase());
    if (!v || v.status !== "active") return { ok: false, error: "Voucher not found or already used." };
    if (amountUsed >= v.amount) { v.status = "redeemed"; v.redeemedAt = nowISO(); }
    else v.amount -= amountUsed;
    writeJSON(JEMAN_KEYS.vouchers, list);
    return { ok: true, voucher: v };
    // TODO(api): notify original buyer that their gift was claimed (the "delight" touch we designed)
  },
  forUser(userId) { return this.all().filter(v => v.buyerUserId === userId); }
};

/* ============================================================
   ORDERS — status lifecycle:
   pending -> payment_sent -> paid -> processing -> shipped -> delivered
                    \-> cancelled (timeout / failed payment)
   ============================================================ */
const Orders = {
  all() { return readJSON(JEMAN_KEYS.orders, []); },
  get(id) { return this.all().find(o => o.id === id) || null; },
  create({ userId, items, address, phone, voucherCode }) {
    const list = this.all();
    let discount = 0;
    if (voucherCode) {
      const v = Vouchers.findByCode(voucherCode);
      if (v && v.status === "active") discount = Math.min(v.amount, items.reduce((s, i) => s + i.price * i.qty, 0));
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const order = {
      id: uid("ord"), ref: "JM" + Date.now().toString().slice(-8),
      userId: userId || null, items, address, phone,
      subtotal, discount, total: Math.max(0, subtotal - discount),
      voucherCode: voucherCode || null,
      status: "pending",
      createdAt: nowISO(),
      reserveUntil: addHours(nowISO(), JEMAN_KEYS.reservationHours),
      history: [{ status: "pending", at: nowISO() }]
    };
    list.push(order);
    writeJSON(JEMAN_KEYS.orders, list);
    return order;
  },
  updateStatus(orderId, status) {
    const list = this.all();
    const o = list.find(x => x.id === orderId);
    if (!o) return null;
    o.status = status;
    o.history.push({ status, at: nowISO() });

    if (status === "paid") {
      // deduct real stock now, award points, redeem any voucher used
      o.items.forEach(it => Products.deductStock(it.productId, it.size, it.qty));
      if (o.userId) Auth.addPoints(o.userId, Math.floor(o.total / 100)); // 1 point per KES 100
      if (o.voucherCode) Vouchers.redeem(o.voucherCode, o.discount);
    }
    writeJSON(JEMAN_KEYS.orders, list);
    return o;
  },
  sendSTKPush(orderId) {
    // TODO(api): replace with real KCB Buni STK push call:
    //   1. POST /oauth/token  -> access token
    //   2. POST /mpesa/stkpush with phone, amount, account ref = order.ref
    //   3. Store merchantRequestId / checkoutRequestId on the order
    //   4. KCB IPN callback hits your webhook -> calls simulateIPN() equivalent server-side
    this.updateStatus(orderId, "payment_sent");
    return { ok: true };
  },
  simulateIPNSuccess(orderId) { return this.updateStatus(orderId, "paid"); },
  simulateIPNFailure(orderId) { return this.updateStatus(orderId, "cancelled"); },
  forUser(userId) { return this.all().filter(o => o.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  releaseExpired() {
    const cutoff = Date.now();
    this.all().filter(o => ["pending"].includes(o.status) && new Date(o.reserveUntil).getTime() < cutoff)
      .forEach(o => this.updateStatus(o.id, "cancelled"));
  }
};

/* ---------- run housekeeping on load ---------- */
Orders.releaseExpired();

/* ============================================================
   BACKEND API CLIENT
   ------------------------------------------------------------
   When js/config.js sets window.JEMAN_API_BASE_URL, these calls
   hit the real server/ (real KCB Buni STK push + IPN). When it's
   left empty, callers fall back to the local Orders simulation
   above — so the same pages work in pure demo mode or fully wired.
   ============================================================ */
const JemanAPI = {
  base() { return window.JEMAN_API_BASE_URL || ""; },
  live() { return !!this.base(); },
  adminToken() { return sessionStorage.getItem('jeman_admin_token'); },

  async adminLogin(password) {
    const r = await fetch(this.base() + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password })
    });
    const data = await r.json();
    if (r.ok) sessionStorage.setItem('jeman_admin_token', data.token);
    return { ok: r.ok, ...data };
  },
  async adminLogout() {
    await fetch(this.base() + '/api/admin/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + this.adminToken() } }).catch(() => {});
    sessionStorage.removeItem('jeman_admin_token');
  },

  async createOrder({ items, address, phone, subtotal, discount }) {
    const r = await fetch(this.base() + '/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, address, phone, subtotal, discount })
    });
    if (!r.ok) throw new Error((await r.json()).error || 'Could not create order');
    return r.json();
  },
  async sendSTKPush(ref) {
    const r = await fetch(this.base() + `/api/orders/${ref}/stkpush`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + this.adminToken() }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'STK push failed');
    return data;
  },
  async getOrder(ref, phone) {
    const url = this.base() + `/api/orders/${ref}` + (phone ? `?phone=${encodeURIComponent(phone)}` : '');
    const r = await fetch(url);
    if (!r.ok) throw new Error((await r.json()).error || 'Order not found');
    return r.json();
  },
  async listOrders() {
    const r = await fetch(this.base() + '/api/orders', { headers: { Authorization: 'Bearer ' + this.adminToken() } });
    if (!r.ok) throw new Error((await r.json()).error || 'Could not load orders');
    return r.json();
  },
  async sendMessage(ref, from, text) {
    const headers = { 'Content-Type': 'application/json' };
    if (from === 'admin') headers.Authorization = 'Bearer ' + this.adminToken();
    const r = await fetch(this.base() + `/api/orders/${ref}/message`, { method: 'POST', headers, body: JSON.stringify({ from, text }) });
    if (!r.ok) throw new Error((await r.json()).error || 'Could not send message');
    return r.json();
  }
};

/* expose globally */
window.JemanStore = { Products, Auth, Cart, Orders, Vouchers, money, uid };
window.JemanAPI = JemanAPI;

