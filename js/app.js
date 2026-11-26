/* Everyride Operations Dashboard
   Static, framework-free. Data lives in this browser's localStorage. */
(() => {
'use strict';

/* ───────────── Utilities ───────────── */
const KEY = 'everyride.admin.v1';
const DRIVER_FEE = 1500; // per day, optional add-on
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const peso = n => (n < 0 ? '-₱' : '₱') + Math.abs(Math.round(n)).toLocaleString('en-PH');
const pesoK = n => n >= 1e6 ? '₱' + (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? '₱' + Math.round(n / 1e3) + 'k' : '₱' + Math.round(n);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const TODAY = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate())); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a, b) => Math.round((parse(a) - parse(b)) / 864e5);
const fmtD = (s, o = { month: 'short', day: 'numeric' }) => parse(s).toLocaleDateString('en-PH', o);
const monthKey = s => s.slice(0, 7);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

const ICON = {
  out: '<path d="M7 17 17 7M8 7h9v9"/>',
  in: '<path d="M17 7 7 17M16 17H7V8"/>',
  alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  car: '<path d="M5 16v-4l2-5h10l2 5v4M5 16h14M5 16v2h2v-2m10 0v2h2v-2M7 12h10"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9m-3 3 3 3"/>',
  chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const ic = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

const CAR_SVG = `<svg viewBox="0 0 120 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 40v-8c0-4 3-6 7-7l14-4 10-11c2-2 4-3 7-3h22c3 0 5 1 7 3l11 11 14 4c4 1 6 3 6 7v8"/><path d="M39 21h42M60 10v11M8 40h13M43 40h34M99 40h13"/><circle cx="32" cy="41" r="8"/><circle cx="88" cy="41" r="8"/></svg>`;

/* ───────────── Data layer ───────────── */
let db = null;
let memoryFallback = null;

function save() {
  const s = JSON.stringify(db);
  try { localStorage.setItem(KEY, s); } catch (e) { memoryFallback = s; }
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d && Array.isArray(d.vehicles) && Array.isArray(d.bookings)) return d; }
  } catch (e) { /* ignore */ }
  return null;
}

function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function seedData() {
  const R = rng(20261125);
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const T = TODAY();
  const vehicles = [
    { id: 'v1', name: 'Mitsubishi Xpander GLS', plate: 'NGX 4821', type: 'MPV', seats: 7, trans: 'Automatic', fuel: 'Gasoline', rate: 2800, year: 2024, maintenance: false },
    { id: 'v2', name: 'Toyota Vios XLE', plate: 'NDB 1357', type: 'Sedan', seats: 5, trans: 'Automatic', fuel: 'Gasoline', rate: 1900, year: 2023, maintenance: false },
    { id: 'v3', name: 'Toyota Innova E', plate: 'NCF 9024', type: 'MPV', seats: 8, trans: 'Manual', fuel: 'Diesel', rate: 3200, year: 2023, maintenance: false },
    { id: 'v4', name: 'Mitsubishi Mirage G4', plate: 'NAZ 7716', type: 'Sedan', seats: 5, trans: 'Automatic', fuel: 'Gasoline', rate: 1600, year: 2022, maintenance: false },
    { id: 'v5', name: 'Toyota Hiace Commuter', plate: 'NEK 3309', type: 'Van', seats: 15, trans: 'Manual', fuel: 'Diesel', rate: 5500, year: 2023, maintenance: false },
    { id: 'v6', name: 'Nissan Urvan NV350', plate: 'NFA 2268', type: 'Van', seats: 15, trans: 'Manual', fuel: 'Diesel', rate: 5000, year: 2022, maintenance: true },
  ];
  const first = ['Juan', 'Maria', 'Jose', 'Ana', 'Mark', 'Angela', 'Paolo', 'Katrina', 'Carlo', 'Bea', 'Miguel', 'Sofia', 'Rafael', 'Camille', 'Jerome', 'Patricia', 'Daniel', 'Isabel', 'Kevin', 'Nicole', 'Ramon', 'Jasmine', 'Gabriel', 'Trisha'];
  const last = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Bautista', 'Ocampo', 'Mendoza', 'Villanueva', 'Aquino', 'Castillo', 'Ramos', 'Flores', 'Navarro', 'Torres', 'Domingo', 'Lim', 'Tan', 'Soriano'];
  const people = Array.from({ length: 22 }, () => ({
    customer: `${pick(first)} ${pick(last)}`,
    phone: `09${ri(15, 99)} ${ri(100, 999)} ${ri(1000, 9999)}`,
    license: `N0${ri(1, 9)}-${ri(10, 24)}-${ri(100000, 999999)}`,
  }));
  const places = ['Everyride Office', 'NAIA Terminal 3', 'Delivery to customer', 'Ayala Center', 'SM Mall of Asia'];
  const notes = ['', '', '', 'Wedding event', 'Airport transfer', 'Family trip', 'Corporate rental', 'Needs child seat', 'Provincial trip'];

  const raw = [];
  const mk = (vi, s, e, status) => {
    const v = vehicles[vi]; const p = pick(people);
    const driver = R() < 0.18;
    const b = { ...p, vehicleId: v.id, start: addDays(T, s), end: addDays(T, e), pickup: pick(places), driver, rate: v.rate, discount: R() < 0.12 ? 500 : 0, paid: 0, status, notes: pick(notes), _s: s };
    const tot = Math.max(1, e - s) * (b.rate + (driver ? DRIVER_FEE : 0)) - b.discount;
    if (status === 'completed') b.paid = R() < 0.07 ? Math.round(tot * 0.5 / 100) * 100 : tot;
    else if (status === 'active') b.paid = R() < 0.6 ? tot : Math.round(tot * 0.5 / 100) * 100;
    else if (status === 'reserved') b.paid = R() < 0.75 ? Math.min(tot, ri(1, 3) * 1000) : 0;
    raw.push(b);
  };
  // Hand-placed current & upcoming bookings so the dashboard has a live feel
  const live = [
    [0, -2, 2, 'active'], [0, 4, 7, 'reserved'],
    [1, -1, 0, 'active'], [1, 2, 4, 'reserved'],
    [2, 0, 3, 'reserved'], [2, 6, 9, 'reserved'],
    [3, -3, 1, 'active'], [3, 3, 5, 'reserved'],
    [4, 0, 4, 'reserved'], [4, 8, 10, 'reserved'],
  ];
  live.forEach(l => mk(...l));
  // Randomized history for each vehicle
  vehicles.forEach((v, vi) => {
    const firstS = Math.min(...live.filter(l => l[0] === vi).map(l => l[1]), -2);
    const limit = firstS - 2;
    let cursor = -150;
    for (;;) {
      const s = cursor + 1 + ri(0, 4); const e = s + ri(1, 6);
      if (e > limit) break;
      mk(vi, s, e, R() < 0.07 ? 'cancelled' : 'completed');
      cursor = e;
    }
  });
  raw.sort((a, b) => a._s - b._s);
  const bookings = raw.map((b, i) => { const { _s, ...rest } = b; return { id: 'ER-' + String(i + 1).padStart(4, '0'), ...rest, created: addDays(b.start, -ri(1, 6)) }; });
  return { vehicles, bookings, seq: bookings.length + 1, seeded: true };
}

/* Derived helpers */
const V = id => db.vehicles.find(v => v.id === id);
const days = b => Math.max(1, diff(b.end, b.start));
const total = b => Math.max(0, days(b) * (b.rate + (b.driver ? DRIVER_FEE : 0)) - (+b.discount || 0));
const isLive = b => b.status !== 'cancelled';
const bal = b => isLive(b) ? Math.max(0, total(b) - (+b.paid || 0)) : 0;
const payState = b => !isLive(b) ? 'none' : bal(b) <= 0 ? 'paid' : (+b.paid > 0 ? 'partial' : 'unpaid');
const overdue = b => b.status === 'active' && b.end < TODAY();
const vStatus = v => v.maintenance ? 'maintenance' : db.bookings.some(b => b.vehicleId === v.id && b.status === 'active') ? 'rented' : 'available';
const nextBooking = v => db.bookings.filter(b => b.vehicleId === v.id && b.status === 'reserved' && b.end >= TODAY()).sort((a, b) => a.start.localeCompare(b.start))[0];
const conflict = (vehicleId, start, end, ignoreId) => db.bookings.find(b => b.vehicleId === vehicleId && isLive(b) && b.id !== ignoreId && start <= b.end && b.start <= end);

function monthSeries(n) {
  const now = parse(TODAY()); const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const bs = db.bookings.filter(b => isLive(b) && monthKey(b.start) === k);
    out.push({ key: k, label: d.toLocaleDateString('en-PH', { month: 'short' }), full: d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }), billed: bs.reduce((a, b) => a + total(b), 0), collected: bs.reduce((a, b) => a + Math.min(+b.paid || 0, total(b)), 0), count: bs.length });
  }
  return out;
}

/* ───────────── UI state ───────────── */
const state = { bk: { q: '', status: 'all', vehicle: 'all', pay: 'all' }, cu: { q: '' }, cal: { off: 0 }, fleetF: 'all', lastRoute: null };

/* ───────────── Components ───────────── */
const badge = (kind, text) => `<span class="badge b-${kind}">${esc(text ?? cap(kind))}</span>`;
const statusBadge = b => overdue(b) ? badge('overdue', 'Overdue') : badge(b.status);
const payBadge = b => { const s = payState(b); return s === 'none' ? '<span class="cell-sub">—</span>' : badge(s, cap(s)); };

function niceMax(v) { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10; return m * p; }

function barChart(series) {
  const W = 640, H = 262, L = 46, B = 30, T = 12, R = 6;
  const pw = W - L - R, ph = H - T - B;
  const max = niceMax(Math.max(...series.map(s => s.billed), 1));
  const y = v => T + ph - (v / max) * ph;
  const g = pw / series.length, bw = Math.min(30, g * 0.26);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue by month">`;
  for (let i = 0; i <= 4; i++) {
    const v = max / 4 * i, yy = y(v);
    s += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" stroke="rgba(0,0,0,.07)"/><text x="${L - 8}" y="${yy + 4}" text-anchor="end">${pesoK(v)}</text>`;
  }
  series.forEach((m, i) => {
    const cx = L + g * i + g / 2;
    const h1 = ph - (y(m.billed) - T), h2 = ph - (y(m.collected) - T);
    s += `<g><title>${esc(m.full)} — Billed ${peso(m.billed)} · Collected ${peso(m.collected)} · ${m.count} bookings</title>
      <rect x="${cx - bw - 2}" y="${y(m.billed)}" width="${bw}" height="${Math.max(h1, 0)}" rx="6" fill="#9acd32"/>
      <rect x="${cx + 2}" y="${y(m.collected)}" width="${bw}" height="${Math.max(h2, 0)}" rx="6" fill="#1f4a0e"/>
      <text x="${cx}" y="${H - 9}" text-anchor="middle" ${i === series.length - 1 ? 'style="fill:#1d1d1f;font-weight:600"' : ''}>${m.label}</text></g>`;
  });
  return s + '</svg>';
}

function donut(parts) {
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1; const r = 54, c = 2 * Math.PI * r; let off = 0;
  const segs = parts.filter(p => p.v > 0).map(p => { const len = p.v / tot * c; const el = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${p.c}" stroke-width="18" stroke-dasharray="${Math.max(len - 3, 0.1)} ${c}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)" stroke-linecap="round"/>`; off += len; return el; }).join('');
  return `<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Fleet status"><circle r="${r}" cx="70" cy="70" fill="none" stroke="#f0f0f2" stroke-width="18"/>${segs}</svg>`;
}

const bookingRow = b => {
  const v = V(b.vehicleId);
  return `<tr class="click" data-action="view-booking" data-id="${b.id}">
    <td><span class="mono">${b.id}</span></td>
    <td><div class="cell-main">${esc(b.customer)}</div><div class="cell-sub">${esc(b.phone)}</div></td>
    <td class="hide-m"><div class="cell-main">${esc(v?.name || 'Removed vehicle')}</div><div class="cell-sub">${esc(v?.plate || '')}</div></td>
    <td>${fmtD(b.start)} → ${fmtD(b.end)}<div class="cell-sub">${days(b)} day${days(b) > 1 ? 's' : ''}</div></td>
    <td class="num">${peso(total(b))}</td>
    <td class="hide-m">${payBadge(b)}</td>
    <td>${statusBadge(b)}</td></tr>`;
};
const bookingsTable = (rows, empty = 'No bookings found') => rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th class="hide-m">Vehicle</th><th>Dates</th><th class="num">Total</th><th class="hide-m">Payment</th><th>Status</th></tr></thead><tbody>${rows.map(bookingRow).join('')}</tbody></table></div>` : `<div class="empty"><b>${empty}</b>Try adjusting your filters or add a new booking.</div>`;

/* ───────────── Views ───────────── */
function viewOverview() {
  const T = TODAY(); const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const active = db.bookings.filter(b => b.status === 'active');
  const pickups = db.bookings.filter(b => b.status === 'reserved' && b.start <= T);
  const returns = db.bookings.filter(b => b.status === 'active' && b.end <= T);
  const ms = monthSeries(6); const cur = ms[ms.length - 1], prev = ms[ms.length - 2];
  const outstanding = db.bookings.reduce((a, b) => a + bal(b), 0);
  const owing = db.bookings.filter(b => bal(b) > 0).length;
  const fleetN = db.vehicles.length, maint = db.vehicles.filter(v => v.maintenance).length;
  const rented = db.vehicles.filter(v => vStatus(v) === 'rented').length;
  const avail = fleetN - maint - rented;
  const util = fleetN - maint ? Math.round(rented / (fleetN - maint) * 100) : 0;

  const sched = [
    ...returns.map(b => ({ b, kind: 'in' })), ...pickups.map(b => ({ b, kind: 'out' })),
  ];
  const schedHtml = sched.length ? `<div class="list">${sched.map(({ b, kind }) => {
    const v = V(b.vehicleId);
    return `<div class="li" data-action="view-booking" data-id="${b.id}" style="cursor:pointer"><div class="ico ${kind}">${ic(kind)}</div><div class="grow"><div class="t">${kind === 'out' ? 'Pickup' : 'Return'} · ${esc(b.customer)}</div><div class="s">${esc(v?.name)} · ${esc(b.pickup)}</div></div>${overdue(b) ? badge('overdue', 'Overdue') : `<span class="cell-sub">${kind === 'out' ? 'Today' : 'Due today'}</span>`}</div>`;
  }).join('')}</div>` : `<div class="empty"><b>All clear</b>No pickups or returns waiting today.</div>`;

  const att = [];
  db.bookings.filter(overdue).forEach(b => att.push({ ico: 'alert', cls: 'in', t: `${b.customer} is overdue`, s: `${V(b.vehicleId)?.name} was due ${fmtD(b.end)}`, id: b.id }));
  db.bookings.filter(b => b.status === 'reserved' && b.paid <= 0 && b.start <= addDays(T, 2)).forEach(b => att.push({ ico: 'cash', cls: 'out', t: `No deposit · ${b.customer}`, s: `Pickup ${fmtD(b.start)} · ${peso(total(b))} total`, id: b.id }));
  const owed = db.bookings.filter(b => b.status === 'completed' && bal(b) > 0);
  if (owed.length) att.push({ ico: 'cash', cls: 'out', t: `${owed.length} completed booking${owed.length > 1 ? 's' : ''} with unpaid balance`, s: `${peso(owed.reduce((a, b) => a + bal(b), 0))} to collect`, route: 'finance' });
  db.vehicles.filter(v => v.maintenance).forEach(v => att.push({ ico: 'wrench', cls: 'out', t: `${v.name} in maintenance`, s: `${v.plate} · unavailable for booking`, route: 'fleet' }));
  const attHtml = att.length ? `<div class="list">${att.slice(0, 6).map(a => `<div class="li" style="cursor:pointer" ${a.id ? `data-action="view-booking" data-id="${a.id}"` : `data-action="go" data-route="${a.route}"`}><div class="ico ${a.cls}">${ic(a.ico)}</div><div class="grow"><div class="t">${esc(a.t)}</div><div class="s">${esc(a.s)}</div></div></div>`).join('')}</div>` : `<div class="empty"><b>Nothing needs attention</b>You're all caught up.</div>`;

  const latest = [...db.bookings].sort((a, b) => (b.created || '').localeCompare(a.created || '') || b.id.localeCompare(a.id)).slice(0, 6);
  const delta = prev.billed ? Math.round((cur.billed - prev.billed) / prev.billed * 100) : 0;

  return `<div class="fade">
  <section class="hero"><div class="hero-body">
    <div class="eyebrow">${fmtD(T, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
    <h1>${greet}, team.<br>Every ride, on track.</h1>
    <p>${active.length} car${active.length === 1 ? ' is' : 's are'} on the road, ${pickups.length} pickup${pickups.length === 1 ? '' : 's'} and ${returns.length} return${returns.length === 1 ? '' : 's'} waiting today.</p>
    <div class="hero-cta"><button class="btn primary" data-action="new-booking">New booking</button><a class="btn soft" href="#/calendar">Open calendar</a></div>
  </div></section>

  <div class="grid kpis">
    <div class="card kpi"><div class="dot">${ic('key')}</div><div class="lbl">Active rentals</div><div class="val">${active.length}<span style="font-size:.5em;color:var(--ink3);font-weight:600"> / ${fleetN}</span></div><div class="note">${util}% fleet utilization</div></div>
    <div class="card kpi"><div class="dot">${ic('clock')}</div><div class="lbl">Today</div><div class="val">${pickups.length} <span style="font-size:.5em;color:var(--ink3);font-weight:600">out</span> · ${returns.length} <span style="font-size:.5em;color:var(--ink3);font-weight:600">in</span></div><div class="note">Pickups and returns</div></div>
    <div class="card kpi accent"><div class="dot">${ic('chart')}</div><div class="lbl">Booked · ${cur.full.split(' ')[0]}</div><div class="val">${peso(cur.billed)}</div><div class="note">${prev.billed ? `<span style="color:var(--y)">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}%</span> vs ${peso(prev.billed)} last month` : `${cur.count} bookings`}</div></div>
    <div class="card kpi"><div class="dot">${ic('cash')}</div><div class="lbl">Outstanding balance</div><div class="val">${peso(outstanding)}</div><div class="note">${owing} booking${owing === 1 ? '' : 's'} with balance</div></div>
  </div>

  <div class="grid cols-2">
    <div class="card"><div class="card-head"><div><h3>Revenue</h3><div class="sub">Last 6 months, by pickup date</div></div><div class="legend"><span><i style="background:#9acd32"></i>Billed</span><span><i style="background:#1f4a0e"></i>Collected</span></div></div>${barChart(ms)}</div>
    <div class="card"><div class="card-head"><div><h3>Today's schedule</h3><div class="sub">Pickups &amp; returns</div></div></div>${schedHtml}</div>
  </div>

  <div class="grid cols-2e" style="margin-top:16px">
    <div class="card"><div class="card-head"><div><h3>Fleet status</h3><div class="sub">${fleetN} vehicles</div></div><a class="btn soft sm" href="#/fleet">Manage</a></div>
      <div class="donut-wrap">${donut([{ v: rented, c: '#ffcb25' }, { v: avail, c: '#9acd32' }, { v: maint, c: '#d93025' }])}
      <div class="donut-leg" style="flex:1;min-width:150px"><div><i style="background:#9acd32"></i>Available<b>${avail}</b></div><div><i style="background:#ffcb25"></i>On rent<b>${rented}</b></div><div><i style="background:#d93025"></i>Maintenance<b>${maint}</b></div></div></div></div>
    <div class="card"><div class="card-head"><div><h3>Needs attention</h3><div class="sub">Items to follow up</div></div></div>${attHtml}</div>
  </div>

  <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Latest bookings</h3><div class="sub">Most recently created</div></div><a class="btn soft sm" href="#/bookings">View all</a></div>${bookingsTable(latest)}</div>
  </div>`;
}

function filteredBookings() {
  const f = state.bk, q = f.q.trim().toLowerCase();
  return db.bookings.filter(b => {
    if (f.status !== 'all' && (f.status === 'overdue' ? !overdue(b) : b.status !== f.status)) return false;
    if (f.vehicle !== 'all' && b.vehicleId !== f.vehicle) return false;
    if (f.pay !== 'all' && payState(b) !== f.pay) return false;
    if (q) { const v = V(b.vehicleId); if (!`${b.id} ${b.customer} ${b.phone} ${v?.name} ${v?.plate} ${b.notes}`.toLowerCase().includes(q)) return false; }
    return true;
  }).sort((a, b) => b.start.localeCompare(a.start) || b.id.localeCompare(a.id));
}
function bookingsBody() { const rows = filteredBookings(); return `<div class="cell-sub" style="margin:0 0 6px 4px">${rows.length} booking${rows.length === 1 ? '' : 's'}</div>${bookingsTable(rows)}`; }

function viewBookings() {
  const f = state.bk;
  const opt = (v, l, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  return `<div class="fade"><div class="ph"><div><h2>Bookings</h2><p>Track every reservation from pickup to return.</p></div><div class="row"><button class="btn primary" data-action="new-booking">New booking</button></div></div>
  <div class="toolbar">
    <div class="search">${ic('search', 16)}<input class="input" id="bk-q" placeholder="Search name, plate, ID…" value="${esc(f.q)}" autocomplete="off"></div>
    <select class="select" id="bk-status" aria-label="Status">${opt('all', 'All statuses', f.status)}${['reserved', 'active', 'overdue', 'completed', 'cancelled'].map(s => opt(s, cap(s), f.status)).join('')}</select>
    <select class="select" id="bk-vehicle" aria-label="Vehicle">${opt('all', 'All vehicles', f.vehicle)}${db.vehicles.map(v => opt(v.id, v.name, f.vehicle)).join('')}</select>
    <select class="select" id="bk-pay" aria-label="Payment">${opt('all', 'Any payment', f.pay)}${['paid', 'partial', 'unpaid'].map(s => opt(s, cap(s), f.pay)).join('')}</select>
  </div>
  <div class="card" id="bk-body">${bookingsBody()}</div></div>`;
}

function viewCalendar() {
  const T = TODAY(); const start = addDays(T, -2 + state.cal.off); const N = 14;
  const dayList = Array.from({ length: N }, (_, i) => addDays(start, i));
  const end = dayList[N - 1];
  const head = `<div class="cal-row cal-h"><div style="border:0"></div>${dayList.map((d, i) => { const dt = parse(d); const we = [0, 6].includes(dt.getDay()); return `<div class="${d === T ? 'today' : ''} ${we ? 'we' : ''}" style="grid-column:${i + 2}">${dt.toLocaleDateString('en-PH', { weekday: 'short' })}<b>${dt.getDate()}</b></div>`; }).join('')}</div>`;
  const rows = db.vehicles.map(v => {
    const cells = dayList.map((d, i) => { const we = [0, 6].includes(parse(d).getDay()); return `<div class="cal-cell ${we ? 'we' : ''} ${d === T ? 'today' : ''}" style="grid-column:${i + 2}" ${v.maintenance ? '' : `data-action="new-booking" data-vehicle="${v.id}" data-date="${d}" title="Book ${esc(v.name)} on ${fmtD(d)}"`}></div>`; }).join('');
    let bars = '';
    if (v.maintenance) bars = `<div class="cal-bar maint">In maintenance</div>`;
    else db.bookings.filter(b => b.vehicleId === v.id && isLive(b) && b.start <= end && b.end >= start).forEach(b => {
      const s = Math.max(0, diff(b.start, start)), e = Math.min(N - 1, diff(b.end, start));
      const cls = b.status === 'active' ? 'active' : b.status === 'completed' ? 'completed' : 'reserved';
      bars += `<button class="cal-bar ${cls}" style="grid-column:${s + 2}/${e + 3}" data-action="view-booking" data-id="${b.id}" title="${esc(b.customer)} · ${fmtD(b.start)} → ${fmtD(b.end)}">${esc(b.customer)}<small>${b.id} · ${days(b)}d${overdue(b) ? ' · overdue' : ''}</small></button>`;
    });
    return `<div class="cal-row"><div class="cal-v" style="grid-column:1;grid-row:1">${esc(v.name)}<small>${esc(v.plate)}</small></div>${cells}${bars}</div>`;
  }).join('');
  return `<div class="fade"><div class="ph"><div><h2>Calendar</h2><p>${fmtD(start)} – ${fmtD(end, { month: 'short', day: 'numeric', year: 'numeric' })} · click an empty day to book</p></div>
    <div class="row"><div class="legend" style="margin-right:8px"><span><i style="background:#1f4a0e"></i>On rent</span><span><i style="background:#cfe2f8"></i>Reserved</span><span><i style="background:#e0e0e2"></i>Completed</span></div>
    <button class="btn soft sm" data-action="cal" data-d="-7" aria-label="Previous week">‹ Week</button><button class="btn soft sm" data-action="cal" data-d="0">Today</button><button class="btn soft sm" data-action="cal" data-d="7" aria-label="Next week">Week ›</button></div></div>
    <div class="card cal"><div class="cal-grid">${head}${rows}</div></div></div>`;
}

function viewFleet() {
  const f = state.fleetF;
  const list = db.vehicles.filter(v => f === 'all' || vStatus(v) === f);
  const cnt = s => s === 'all' ? db.vehicles.length : db.vehicles.filter(v => vStatus(v) === s).length;
  return `<div class="fade"><div class="ph"><div><h2>Fleet</h2><p>${db.vehicles.length} vehicles · live availability.</p></div><div class="row">
    <div class="seg" role="tablist">${['all', 'available', 'rented', 'maintenance'].map(s => `<button class="${f === s ? 'on' : ''}" data-action="fleet-filter" data-f="${s}">${s === 'all' ? 'All' : s === 'rented' ? 'On rent' : cap(s)} ${cnt(s)}</button>`).join('')}</div>
    <button class="btn dark" data-action="new-vehicle">Add vehicle</button></div></div>
  <div class="grid cols-3">${list.map(v => {
    const st = vStatus(v); const nb = nextBooking(v); const cur = db.bookings.find(b => b.vehicleId === v.id && b.status === 'active');
    const note = cur ? `Returns ${fmtD(cur.end)} · ${esc(cur.customer)}` : nb ? `Next: ${fmtD(nb.start)} · ${esc(nb.customer)}` : st === 'maintenance' ? 'Not available for booking' : 'No upcoming bookings';
    const done = db.bookings.filter(b => b.vehicleId === v.id && isLive(b)).length;
    return `<div class="card vcard"><div class="vart">${CAR_SVG}${badge(st, st === 'rented' ? 'On rent' : cap(st))}<span class="plate">${esc(v.plate)}</span></div>
      <div class="vbody"><div><h3>${esc(v.name)}</h3><div class="cell-sub">${note}</div></div>
      <div class="specs"><span class="chip">${v.year}</span><span class="chip">${esc(v.type)}</span><span class="chip">${v.seats} seats</span><span class="chip">${esc(v.trans)}</span><span class="chip">${esc(v.fuel)}</span><span class="chip">${done} trips</span></div>
      <div class="vfoot"><div class="price">${peso(v.rate)}<small> /day</small></div><div style="display:flex;gap:6px"><button class="btn soft sm" data-action="edit-vehicle" data-id="${v.id}">Edit</button><button class="btn primary sm" data-action="new-booking" data-vehicle="${v.id}" ${v.maintenance ? 'disabled' : ''}>Book</button></div></div></div></div>`;
  }).join('')}</div>${list.length ? '' : '<div class="card empty"><b>No vehicles here</b>Nothing matches this filter.</div>'}</div>`;
}

function customerList() {
  const map = new Map();
  db.bookings.forEach(b => {
    const k = b.phone.replace(/\D/g, '') || b.customer.toLowerCase();
    const c = map.get(k) || { name: b.customer, phone: b.phone, license: b.license, n: 0, spent: 0, last: '', owing: 0 };
    if (isLive(b)) { c.n++; c.spent += total(b); c.owing += bal(b); }
    if (b.start >= c.last) { c.last = b.start; c.name = b.customer; }
    map.set(k, c);
  });
  return [...map.values()].filter(c => c.n > 0 || true).sort((a, b) => b.spent - a.spent);
}
function customersBody() {
  const q = state.cu.q.trim().toLowerCase();
  const rows = customerList().filter(c => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q));
  return rows.length ? `<div class="tbl-wrap"><table><thead><tr><th>Customer</th><th class="hide-m">License</th><th class="num">Bookings</th><th class="num">Lifetime spend</th><th class="num hide-m">Balance</th><th class="hide-m">Last rental</th></tr></thead><tbody>${rows.map(c => `<tr class="click" data-action="cust-bookings" data-name="${esc(c.name)}"><td><div class="cell-main">${esc(c.name)}</div><div class="cell-sub">${esc(c.phone)}</div></td><td class="hide-m mono">${esc(c.license || '—')}</td><td class="num">${c.n}</td><td class="num">${peso(c.spent)}</td><td class="num hide-m">${c.owing ? `<span class="down">${peso(c.owing)}</span>` : '—'}</td><td class="hide-m">${c.last ? fmtD(c.last, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>No customers found</b></div>`;
}
function viewCustomers() {
  const all = customerList(); const repeat = all.filter(c => c.n > 1).length;
  return `<div class="fade"><div class="ph"><div><h2>Customers</h2><p>${all.length} customers · ${repeat} repeat renters. Customers are created automatically from bookings.</p></div></div>
  <div class="toolbar"><div class="search">${ic('search', 16)}<input class="input" id="cu-q" placeholder="Search name or phone…" value="${esc(state.cu.q)}" autocomplete="off"></div></div>
  <div class="card" id="cu-body">${customersBody()}</div></div>`;
}

function viewFinance() {
  const ms = monthSeries(6); const cur = ms[ms.length - 1];
  const live = db.bookings.filter(isLive);
  const outstanding = db.bookings.filter(b => bal(b) > 0).sort((a, b) => a.end.localeCompare(b.end));
  const allBilled = live.reduce((a, b) => a + total(b), 0);
  const avg = live.length ? allBilled / live.length : 0;
  const per = db.vehicles.map(v => ({ v, amt: live.filter(b => b.vehicleId === v.id).reduce((a, b) => a + total(b), 0), n: live.filter(b => b.vehicleId === v.id).length })).sort((a, b) => b.amt - a.amt);
  const mx = Math.max(...per.map(p => p.amt), 1);
  const collRate = cur.billed ? Math.round(cur.collected / cur.billed * 100) : 0;
  return `<div class="fade"><div class="ph"><div><h2>Finance</h2><p>Billed vs collected, balances and vehicle performance.</p></div><div class="row"><button class="btn soft" data-action="export-csv">Export bookings CSV</button></div></div>
  <div class="grid kpis" style="margin-top:0">
    <div class="card kpi accent"><div class="lbl">Billed · ${cur.full.split(' ')[0]}</div><div class="val">${peso(cur.billed)}</div><div class="note">${cur.count} bookings</div></div>
    <div class="card kpi"><div class="lbl">Collected · ${cur.full.split(' ')[0]}</div><div class="val">${peso(cur.collected)}</div><div class="note">${collRate}% of billed</div></div>
    <div class="card kpi"><div class="lbl">Outstanding (all)</div><div class="val">${peso(outstanding.reduce((a, b) => a + bal(b), 0))}</div><div class="note">${outstanding.length} open balances</div></div>
    <div class="card kpi"><div class="lbl">Avg. booking value</div><div class="val">${peso(avg)}</div><div class="note">${live.length} bookings all-time</div></div>
  </div>
  <div class="grid cols-2">
    <div class="card"><div class="card-head"><div><h3>Monthly revenue</h3><div class="sub">Billed vs collected</div></div><div class="legend"><span><i style="background:#9acd32"></i>Billed</span><span><i style="background:#1f4a0e"></i>Collected</span></div></div>${barChart(ms)}</div>
    <div class="card"><div class="card-head"><div><h3>Revenue by vehicle</h3><div class="sub">All-time billed</div></div></div>${per.map(p => `<div class="bar-row"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(p.v.name)}">${esc(p.v.name.replace(/^(Toyota|Mitsubishi|Nissan) /, ''))}</div><div class="track"><div class="fill" style="width:${p.amt / mx * 100}%"></div></div><div class="num" style="text-align:right;font-variant-numeric:tabular-nums"><b>${pesoK(p.amt)}</b></div></div>`).join('')}</div>
  </div>
  <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Outstanding balances</h3><div class="sub">Oldest first — tap a row to record a payment</div></div></div>
  ${outstanding.length ? `<div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Customer</th><th>Return date</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th></tr></thead><tbody>${outstanding.slice(0, 25).map(b => `<tr class="click" data-action="view-booking" data-id="${b.id}"><td class="mono">${b.id}</td><td><div class="cell-main">${esc(b.customer)}</div><div class="cell-sub">${esc(b.phone)}</div></td><td>${fmtD(b.end)}</td><td class="num">${peso(total(b))}</td><td class="num">${peso(b.paid)}</td><td class="num"><b class="down">${peso(bal(b))}</b></td><td>${statusBadge(b)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><b>Fully collected</b>No open balances.</div>`}</div></div>`;
}

/* ───────────── Router ───────────── */
const ROUTES = { overview: viewOverview, bookings: viewBookings, calendar: viewCalendar, fleet: viewFleet, customers: viewCustomers, finance: viewFinance };
function route() { const r = (location.hash.replace(/^#\/?/, '') || 'overview').split('?')[0]; return ROUTES[r] ? r : 'overview'; }
function render() {
  const r = route();
  $('#app').innerHTML = ROUTES[r]();
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.route === r));
  if (state.lastRoute !== r) { window.scrollTo(0, 0); state.lastRoute = r; }
  document.title = `${cap(r)} · Everyride Operations`;
}

/* ───────────── Dialogs ───────────── */
const dlg = () => $('#dlg');
function openDlg(html) { const d = dlg(); d.innerHTML = html; if (!d.open) d.showModal(); }
function closeDlg() { const d = dlg(); if (d.open) d.close(); }
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2800); }
const dHead = (title, sub) => `<div class="d-head"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}</div><button class="x" data-action="close" aria-label="Close">×</button></div>`;

function bookingFormHtml(b, pre = {}) {
  const edit = !!(b && b.id);
  const T = TODAY();
  const firstFree = db.vehicles.find(v => !v.maintenance);
  b = b || { customer: '', phone: '', license: '', vehicleId: pre.vehicle || firstFree?.id, start: pre.date || T, end: addDays(pre.date || T, 2), pickup: 'Everyride Office', driver: false, discount: 0, paid: 0, status: 'reserved', notes: '' };
  const vopts = db.vehicles.filter(v => !v.maintenance || v.id === b.vehicleId).map(v => `<option value="${v.id}" data-rate="${v.rate}" ${v.id === b.vehicleId ? 'selected' : ''}>${esc(v.name)} · ${esc(v.plate)} · ${peso(v.rate)}/day</option>`).join('');
  const places = ['Everyride Office', 'NAIA Terminal 3', 'Delivery to customer', 'Ayala Center', 'SM Mall of Asia'];
  return `<form id="bk-form" data-id="${edit ? b.id : ''}" data-rate="${edit ? b.rate : ''}" data-vid="${edit ? b.vehicleId : ''}" autocomplete="off" novalidate style="display:contents">
  ${dHead(edit ? `Edit ${b.id}` : 'New booking', edit ? 'Update reservation details.' : 'Create a reservation for a customer.')}
  <div class="d-body"><div class="form">
    <div class="field"><label for="f-customer">Customer name</label><input class="input" id="f-customer" name="customer" value="${esc(b.customer)}" placeholder="e.g. Juan Dela Cruz" required></div>
    <div class="field"><label for="f-phone">Mobile number</label><input class="input" id="f-phone" name="phone" value="${esc(b.phone)}" placeholder="09XX XXX XXXX" inputmode="tel" required></div>
    <div class="field"><label for="f-license">Driver's license no.</label><input class="input" id="f-license" name="license" value="${esc(b.license)}" placeholder="Optional"></div>
    <div class="field"><label for="f-vehicle">Vehicle</label><select class="select input" id="f-vehicle" name="vehicleId">${vopts}</select></div>
    <div class="field"><label for="f-start">Pickup date</label><input class="input" type="date" id="f-start" name="start" value="${b.start}" required></div>
    <div class="field"><label for="f-end">Return date</label><input class="input" type="date" id="f-end" name="end" value="${b.end}" required></div>
    <div class="field"><label for="f-pickup">Pickup location</label><select class="select input" id="f-pickup" name="pickup">${places.map(p => `<option ${p === b.pickup ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
    <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="driver" ${b.driver ? 'checked' : ''}> With driver (+${peso(DRIVER_FEE)}/day)</label></div>
    <div class="field"><label for="f-discount">Discount (₱)</label><input class="input" type="number" min="0" step="100" id="f-discount" name="discount" value="${b.discount || 0}"></div>
    <div class="field"><label for="f-paid">Amount paid (₱)</label><input class="input" type="number" min="0" step="100" id="f-paid" name="paid" value="${b.paid || 0}"><div class="hint">Deposit or full payment received</div></div>
    ${edit ? `<div class="field"><label for="f-status">Status</label><select class="select input" id="f-status" name="status">${['reserved', 'active', 'completed', 'cancelled'].map(s => `<option value="${s}" ${s === b.status ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select></div><div></div>` : ''}
    <div class="field full"><label for="f-notes">Notes</label><textarea class="textarea" id="f-notes" name="notes" placeholder="Special requests, trip purpose, etc.">${esc(b.notes)}</textarea></div>
    <div class="full"><div class="warn" id="bk-warn" hidden></div></div>
    <div class="full summary" id="bk-sum"></div>
  </div></div>
  <div class="d-foot"><button type="button" class="btn soft" data-action="close">Cancel</button><button type="submit" class="btn primary">${edit ? 'Save changes' : 'Create booking'}</button></div></form>`;
}

function readForm(form) {
  const fd = new FormData(form);
  const vehicleId = fd.get('vehicleId'); const v = V(vehicleId);
  const keep = form.dataset.id && form.dataset.vid === vehicleId && form.dataset.rate;
  return {
    customer: String(fd.get('customer') || '').trim(), phone: String(fd.get('phone') || '').trim(), license: String(fd.get('license') || '').trim(),
    vehicleId, start: fd.get('start'), end: fd.get('end'), pickup: fd.get('pickup'), driver: fd.get('driver') === 'on',
    discount: Math.max(0, +fd.get('discount') || 0), paid: Math.max(0, +fd.get('paid') || 0), notes: String(fd.get('notes') || '').trim(),
    status: fd.get('status') || 'reserved', rate: keep ? +form.dataset.rate : (v?.rate || 0),
  };
}

function updateSummary() {
  const form = $('#bk-form'); if (!form) return;
  const b = readForm(form); const id = form.dataset.id;
  const sum = $('#bk-sum'), warn = $('#bk-warn');
  const validDates = b.start && b.end && b.end >= b.start;
  const d = validDates ? days(b) : 0, t = validDates ? total(b) : 0;
  sum.innerHTML = `<div><span>Rate</span><b>${peso(b.rate)} × ${d} day${d === 1 ? '' : 's'}</b></div>${b.driver ? `<div><span>Driver</span><b>${peso(DRIVER_FEE)} × ${d}</b></div>` : ''}${b.discount ? `<div><span>Discount</span><b>−${peso(b.discount)}</b></div>` : ''}<div><span>Paid</span><b>${peso(b.paid)}</b></div><div><span>Balance</span><b>${peso(Math.max(0, t - b.paid))}</b></div><div class="tot"><span>Total</span><b>${peso(t)}</b></div>`;
  let msg = '';
  if (b.start && b.end && b.end < b.start) msg = 'Return date must be on or after the pickup date.';
  else if (validDates && b.status !== 'cancelled') { const c = conflict(b.vehicleId, b.start, b.end, id); if (c) msg = `${V(b.vehicleId)?.name} is already booked by ${c.customer} (${fmtD(c.start)} → ${fmtD(c.end)}).`; }
  warn.hidden = !msg; warn.textContent = msg;
  return !msg;
}

function openBookingForm(b, pre) { openDlg(bookingFormHtml(b, pre)); updateSummary(); }

function openBookingView(id) {
  const b = db.bookings.find(x => x.id === id); if (!b) return;
  const v = V(b.vehicleId);
  const next = b.status === 'reserved' ? `<button class="btn dark" data-action="status" data-id="${b.id}" data-to="active">Mark picked up</button>` : b.status === 'active' ? `<button class="btn dark" data-action="status" data-id="${b.id}" data-to="completed">Mark returned</button>` : '';
  const cancel = ['reserved', 'active'].includes(b.status) ? `<button class="btn soft" data-action="status" data-id="${b.id}" data-to="cancelled">Cancel booking</button>` : b.status === 'cancelled' ? `<button class="btn soft" data-action="status" data-id="${b.id}" data-to="reserved">Reinstate</button>` : '';
  openDlg(`${dHead(`${esc(b.customer)}`, `<span class="mono">${b.id}</span> · ${statusBadge(b)} ${payBadge(b)}`)}
  <div class="d-body">
    <dl class="dl"><dt>Vehicle</dt><dd>${esc(v?.name || '—')} <span class="cell-sub">${esc(v?.plate || '')}</span></dd>
    <dt>Pickup</dt><dd>${fmtD(b.start, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${esc(b.pickup)}</dd>
    <dt>Return</dt><dd>${fmtD(b.end, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${days(b)} day${days(b) > 1 ? 's' : ''}</dd>
    <dt>Mobile</dt><dd><a href="tel:${esc(b.phone.replace(/\s/g, ''))}" style="color:var(--blue)">${esc(b.phone)}</a></dd>
    <dt>License</dt><dd class="mono">${esc(b.license || '—')}</dd>
    <dt>Driver</dt><dd>${b.driver ? 'Included' : 'Self-drive'}</dd>
    ${b.notes ? `<dt>Notes</dt><dd>${esc(b.notes)}</dd>` : ''}</dl>
    <div class="summary" style="margin:10px 0 4px"><div><span>Rental · ${peso(b.rate)} × ${days(b)}</span><b>${peso(days(b) * b.rate)}</b></div>${b.driver ? `<div><span>Driver · ${peso(DRIVER_FEE)} × ${days(b)}</span><b>${peso(days(b) * DRIVER_FEE)}</b></div>` : ''}${b.discount ? `<div><span>Discount</span><b>−${peso(b.discount)}</b></div>` : ''}<div><span>Paid</span><b>${peso(b.paid)}</b></div><div><span>Balance</span><b>${peso(bal(b))}</b></div><div class="tot"><span>Total</span><b>${peso(total(b))}</b></div></div>
    ${bal(b) > 0 ? `<div style="display:flex;gap:8px;margin-top:12px"><input class="input" id="pay-amt" type="number" min="1" step="100" placeholder="Payment amount (₱)" style="flex:1"><button class="btn primary" data-action="pay" data-id="${b.id}">Add payment</button><button class="btn soft" data-action="pay-full" data-id="${b.id}">Paid in full</button></div>` : ''}
  </div>
  <div class="d-foot"><button class="btn danger left" data-action="delete-booking" data-id="${b.id}">Delete</button><button class="btn soft" data-action="edit-booking" data-id="${b.id}">Edit</button>${cancel}${next}</div>`);
}

function openVehicleForm(v) {
  const edit = !!v; v = v || { name: '', plate: '', type: 'Sedan', seats: 5, trans: 'Automatic', fuel: 'Gasoline', rate: 2000, year: new Date().getFullYear(), maintenance: false };
  const sel = (name, opts, cur) => `<select class="select input" name="${name}">${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  openDlg(`<form id="v-form" data-id="${edit ? v.id : ''}" novalidate style="display:contents">${dHead(edit ? 'Edit vehicle' : 'Add vehicle', 'Fleet details and daily rate.')}
  <div class="d-body"><div class="form">
    <div class="field full"><label>Vehicle name</label><input class="input" name="name" value="${esc(v.name)}" placeholder="e.g. Toyota Fortuner 2.4 G" required></div>
    <div class="field"><label>Plate number</label><input class="input" name="plate" value="${esc(v.plate)}" placeholder="ABC 1234" required></div>
    <div class="field"><label>Year</label><input class="input" type="number" name="year" value="${v.year}" min="1990" max="2100"></div>
    <div class="field"><label>Type</label>${sel('type', ['Sedan', 'Hatchback', 'SUV', 'MPV', 'Pickup', 'Van'], v.type)}</div>
    <div class="field"><label>Seats</label><input class="input" type="number" name="seats" value="${v.seats}" min="1" max="30"></div>
    <div class="field"><label>Transmission</label>${sel('trans', ['Automatic', 'Manual'], v.trans)}</div>
    <div class="field"><label>Fuel</label>${sel('fuel', ['Gasoline', 'Diesel', 'Hybrid', 'Electric'], v.fuel)}</div>
    <div class="field"><label>Daily rate (₱)</label><input class="input" type="number" name="rate" value="${v.rate}" min="0" step="100" required></div>
    <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="maintenance" ${v.maintenance ? 'checked' : ''}> In maintenance</label></div>
    <div class="full"><div class="warn" id="v-warn" hidden></div></div>
  </div></div>
  <div class="d-foot">${edit ? `<button type="button" class="btn danger left" data-action="delete-vehicle" data-id="${v.id}">Delete</button>` : ''}<button type="button" class="btn soft" data-action="close">Cancel</button><button class="btn primary" type="submit">${edit ? 'Save' : 'Add vehicle'}</button></div></form>`);
}

function openDataDialog() {
  openDlg(`${dHead('Data & backup', 'Your data is stored in this browser only.')}
  <div class="d-body"><div class="list">
    <div class="li"><div class="grow"><div class="t">Export backup (JSON)</div><div class="s">Download everything — bookings, fleet. Keep it safe.</div></div><button class="btn soft sm" data-action="export-json">Export</button></div>
    <div class="li"><div class="grow"><div class="t">Import backup</div><div class="s">Replace current data with a backup file.</div></div><button class="btn soft sm" data-action="import-json">Import</button></div>
    <div class="li"><div class="grow"><div class="t">Export bookings (CSV)</div><div class="s">Open in Excel or Google Sheets.</div></div><button class="btn soft sm" data-action="export-csv">Export</button></div>
    <div class="li"><div class="grow"><div class="t">Reload demo data</div><div class="s">Sample fleet and bookings for testing.</div></div><button class="btn soft sm" data-action="reset-demo">Reload</button></div>
    <div class="li"><div class="grow"><div class="t">Start fresh</div><div class="s">Clear all bookings and keep an empty fleet.</div></div><button class="btn danger sm" data-action="clear-all">Clear all</button></div>
  </div><input type="file" id="import-file" accept="application/json,.json" hidden></div>
  <div class="d-foot"><button class="btn soft" data-action="close">Done</button></div>`);
}

/* ───────────── Actions ───────────── */
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function exportCsv() {
  const cols = ['ID', 'Customer', 'Phone', 'License', 'Vehicle', 'Plate', 'Pickup', 'Return', 'Days', 'Pickup location', 'Driver', 'Rate', 'Discount', 'Total', 'Paid', 'Balance', 'Status', 'Notes'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = db.bookings.map(b => { const v = V(b.vehicleId); return [b.id, b.customer, b.phone, b.license, v?.name, v?.plate, b.start, b.end, days(b), b.pickup, b.driver ? 'Yes' : 'No', b.rate, b.discount, total(b), b.paid, bal(b), b.status, b.notes].map(q).join(','); });
  download(`everyride-bookings-${TODAY()}.csv`, '﻿' + [cols.map(q).join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  toast('Bookings exported');
}

function refresh() { save(); render(); }
function refreshKeepDlg() { save(); render(); }

const actions = {
  close: closeDlg,
  go: el => { location.hash = '#/' + el.dataset.route; closeDlg(); },
  'new-booking': el => openBookingForm(null, { vehicle: el.dataset.vehicle, date: el.dataset.date }),
  'edit-booking': el => openBookingForm(db.bookings.find(b => b.id === el.dataset.id)),
  'view-booking': el => openBookingView(el.dataset.id),
  status: el => {
    const b = db.bookings.find(x => x.id === el.dataset.id); const to = el.dataset.to;
    if (to === 'cancelled' && !confirm(`Cancel booking ${b.id} for ${b.customer}?`)) return;
    if (to === 'active' || to === 'reserved') { const c = conflict(b.vehicleId, b.start, b.end, b.id); if (c && (to === 'reserved')) { toast(`Can't reinstate — vehicle booked by ${c.customer}`); return; } }
    b.status = to; refresh(); openBookingView(b.id);
    toast(to === 'completed' ? (bal(b) > 0 ? `Returned — ${peso(bal(b))} balance remaining` : 'Vehicle returned') : to === 'active' ? 'Marked as picked up' : to === 'cancelled' ? 'Booking cancelled' : 'Booking reinstated');
  },
  pay: el => { const b = db.bookings.find(x => x.id === el.dataset.id); const amt = +$('#pay-amt').value; if (!(amt > 0)) { toast('Enter a payment amount'); return; } b.paid = (+b.paid || 0) + amt; refresh(); openBookingView(b.id); toast(`${peso(amt)} payment recorded`); },
  'pay-full': el => { const b = db.bookings.find(x => x.id === el.dataset.id); b.paid = total(b); refresh(); openBookingView(b.id); toast('Marked as paid in full'); },
  'delete-booking': el => { const b = db.bookings.find(x => x.id === el.dataset.id); if (!confirm(`Delete ${b.id} (${b.customer}) permanently?`)) return; db.bookings = db.bookings.filter(x => x !== b); closeDlg(); refresh(); toast('Booking deleted'); },
  'new-vehicle': () => openVehicleForm(),
  'edit-vehicle': el => openVehicleForm(V(el.dataset.id)),
  'delete-vehicle': el => { const v = V(el.dataset.id); if (db.bookings.some(b => b.vehicleId === v.id)) { const w = $('#v-warn'); w.hidden = false; w.textContent = 'This vehicle has booking history. Mark it as "In maintenance" instead of deleting.'; return; } if (!confirm(`Delete ${v.name}?`)) return; db.vehicles = db.vehicles.filter(x => x !== v); closeDlg(); refresh(); toast('Vehicle deleted'); },
  'fleet-filter': el => { state.fleetF = el.dataset.f; render(); },
  cal: el => { const d = +el.dataset.d; state.cal.off = d === 0 ? 0 : state.cal.off + d; render(); },
  'cust-bookings': el => { state.bk = { q: el.dataset.name, status: 'all', vehicle: 'all', pay: 'all' }; location.hash = '#/bookings'; if (route() === 'bookings') render(); },
  'open-data': openDataDialog,
  'export-csv': exportCsv,
  'export-json': () => { download(`everyride-backup-${TODAY()}.json`, JSON.stringify(db, null, 2), 'application/json'); toast('Backup downloaded'); },
  'import-json': () => $('#import-file').click(),
  'reset-demo': () => { if (!confirm('Replace all current data with demo data?')) return; db = seedData(); closeDlg(); refresh(); toast('Demo data loaded'); },
  'clear-all': () => { if (!confirm('Delete ALL bookings and vehicles? Export a backup first if unsure.')) return; db = { vehicles: [], bookings: [], seq: 1 }; closeDlg(); refresh(); toast('All data cleared'); },
};

document.addEventListener('click', e => {
  if (e.target === dlg()) { closeDlg(); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action]; if (fn) { e.preventDefault(); fn(el); }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.closest('#bk-form')) updateSummary();
  else if (t.id === 'bk-q') { state.bk.q = t.value; $('#bk-body').innerHTML = bookingsBody(); }
  else if (t.id === 'cu-q') { state.cu.q = t.value; $('#cu-body').innerHTML = customersBody(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.closest('#bk-form')) updateSummary();
  else if (['bk-status', 'bk-vehicle', 'bk-pay'].includes(t.id)) { state.bk[t.id.slice(3)] = t.value; $('#bk-body').innerHTML = bookingsBody(); }
  else if (t.id === 'import-file' && t.files[0]) {
    const rd = new FileReader();
    rd.onload = () => { try { const d = JSON.parse(rd.result); if (!Array.isArray(d.vehicles) || !Array.isArray(d.bookings)) throw 0; if (!confirm(`Import ${d.bookings.length} bookings and ${d.vehicles.length} vehicles? This replaces current data.`)) return; db = d; closeDlg(); refresh(); toast('Backup imported'); } catch (_) { toast('That file is not a valid Everyride backup'); } };
    rd.readAsText(t.files[0]);
  }
});

document.addEventListener('submit', e => {
  const f = e.target; e.preventDefault();
  if (f.id === 'bk-form') {
    const b = readForm(f); const warn = $('#bk-warn');
    const fail = m => { warn.hidden = false; warn.textContent = m; warn.scrollIntoView({ block: 'nearest' }); };
    if (!b.customer) return fail('Please enter the customer name.');
    if (!b.phone) return fail('Please enter a mobile number.');
    if (!b.vehicleId) return fail('Add a vehicle in Fleet first.');
    if (!b.start || !b.end) return fail('Please choose pickup and return dates.');
    if (b.end < b.start) return fail('Return date must be on or after the pickup date.');
    if (!updateSummary()) return;
    const id = f.dataset.id;
    if (id) { Object.assign(db.bookings.find(x => x.id === id), b); toast('Booking updated'); }
    else {
      const nid = 'ER-' + String(db.seq++).padStart(4, '0');
      db.bookings.push({ id: nid, ...b, status: 'reserved', created: TODAY() });
      toast(`Booking ${nid} created`);
    }
    closeDlg(); refresh();
    if (route() === 'overview') { /* stay */ }
  } else if (f.id === 'v-form') {
    const fd = new FormData(f); const w = $('#v-warn');
    const o = { name: String(fd.get('name')).trim(), plate: String(fd.get('plate')).trim().toUpperCase(), type: fd.get('type'), seats: +fd.get('seats') || 5, trans: fd.get('trans'), fuel: fd.get('fuel'), rate: +fd.get('rate') || 0, year: +fd.get('year') || new Date().getFullYear(), maintenance: fd.get('maintenance') === 'on' };
    if (!o.name || !o.plate) { w.hidden = false; w.textContent = 'Vehicle name and plate number are required.'; return; }
    if (db.vehicles.some(v => v.plate === o.plate && v.id !== f.dataset.id)) { w.hidden = false; w.textContent = 'A vehicle with that plate already exists.'; return; }
    if (f.dataset.id) { Object.assign(V(f.dataset.id), o); toast('Vehicle updated'); }
    else { db.vehicles.push({ id: 'v' + Date.now().toString(36), ...o }); toast('Vehicle added'); }
    closeDlg(); refresh();
  }
});

window.addEventListener('hashchange', render);
// Keep "today" fresh if the tab stays open overnight
setInterval(() => { if (state.today !== TODAY()) { state.today = TODAY(); if (!dlg().open) render(); } }, 60000);

/* ───────────── Boot ───────────── */
db = load();
if (!db) { db = seedData(); save(); }
state.today = TODAY();
$('#yr').textContent = new Date().getFullYear();
render();
})();
