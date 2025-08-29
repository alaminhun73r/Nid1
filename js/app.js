// js/app.js
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  setPersistence,
  browserLocalPersistence
} from "./firebase-init.js";

/* ---------- Default services fallback ---------- */
const DEFAULT_SERVICES = [
  { title: "Sign Copy (সাইন কপি)", slug: "sign-copy", price: 110, desc: "সাইন কপির সেবা", color: "var(--green)", icon: "✍️" },
  { title: "NID PDF", slug: "nid-pdf", price: 80, desc: "NID PDF তৈরী", color: "var(--blue)", icon: "🪪" },
  { title: "TIN Certificate", slug: "tin-cert", price: 120, desc: "TIN সার্ভিস", color: "var(--orange)", icon: "📄" }
];

/* ---------- Helpers ---------- */
function q(sel) { return document.querySelector(sel); }
function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => { if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); });
  children.forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else if (c) e.appendChild(c); });
  return e;
}
function getQueryParam(name) { return new URLSearchParams(location.search).get(name); }
function tk(n){ return `${n} ৳`; }
async function ensureUserDoc(uid, email, name = "") {
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (!snap.exists()) {
    await setDoc(uref, { email: email || "", fullName: name || "", balance: 0, role: "user", createdAt: serverTimestamp() });
  }
}

/* ---------- Auth state UI (header) ---------- */
let currentUser = null;
async function refreshHeaderUI() {
  const container = q('#header-auth');
  if (!container) return;
  container.innerHTML = '';
  if (!currentUser) {
    container.appendChild(el('a', { href: 'login.html', class: 'btn small' }, 'Login'));
    container.appendChild(el('a', { href: 'register.html', class: 'btn small muted' }, 'Register'));
  } else {
    const uref = doc(db, "users", currentUser.uid);
    const usnap = await getDoc(uref);
    const data = usnap.exists() ? usnap.data() : { balance: 0, role: 'user', fullName: '' };
    const balBtn = el('a', { href: 'recharge.html', class: 'btn small' }, tk(data.balance || 0));
    const profileLink = el('a', { href: 'profile.html', class: 'btn small muted' }, data.fullName || currentUser.email || 'Profile');
    container.appendChild(balBtn);
    container.appendChild(profileLink);
    if ((data.role || '') === 'admin') {
      container.appendChild(el('a', { href: 'admin.html', class: 'btn small admin' }, 'Admin'));
    }
    const logout = el('button', { class: 'btn small danger' }, 'Logout');
    logout.onclick = async () => { await signOut(auth); location.href = 'index.html'; };
    container.appendChild(logout);
  }
}

/* ---------- Page initializers ---------- */

async function initIndex() {
  const out = q('#services');
  out.innerHTML = 'Loading services...';
  let services = [];
  try {
    const snap = await getDocs(collection(db, 'services'));
    if (!snap.empty) {
      snap.forEach(d => services.push({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('services fetch failed', err);
  }
  if (services.length === 0) services = DEFAULT_SERVICES;
  out.innerHTML = '';
  services.forEach(s => {
    const a = el('a', { href: `service.html?slug=${encodeURIComponent(s.slug)}`, class: 'card', style: `--card-color:${s.color || 'var(--green)'};` },
      el('div', { class: 'card-left' }, el('div', { class: 'card-icon' }, s.icon || '📦')),
      el('div', { class: 'card-body' }, el('div', { class: 'card-title' }, s.title), el('div', { class: 'card-desc' }, s.desc)),
      el('div', { class: 'card-price' }, tk(s.price || 0))
    );
    out.appendChild(a);
  });
}

async function initService() {
  const slug = getQueryParam('slug') || 'sign-copy';
  const target = q('#service-root');
  target.innerHTML = 'Loading...';
  let service = null;
  try {
    const qSnap = await getDocs(query(collection(db, 'services'), where('slug', '==', slug)));
    if (!qSnap.empty) service = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
  } catch (err) {
    console.warn('service fetch error', err);
  }
  if (!service) {
    service = DEFAULT_SERVICES.find(s => s.slug === slug) || DEFAULT_SERVICES[0];
  }

  target.innerHTML = '';
  target.appendChild(el('div', { class: 'notice' }, `${service.title} এর জন্য ${tk(service.price)} কাটা হবে।`));

  const card = el('div', { class: 'order-card' });
  card.appendChild(el('h2', {}, service.title));
  card.appendChild(el('p', { class: 'muted' }, service.desc));

  const form = el('form', { id: 'orderForm' });
  form.appendChild(el('label', {}, 'Select Type:'));
  const sel = el('select', { name: 'type', required: true, class: 'input' },
    el('option', { value: '' }, 'Select'),
    el('option', { value: 'nid' }, 'NID'),
    el('option', { value: 'voter' }, 'Voter'),
    el('option', { value: 'form' }, 'Form')
  );
  form.appendChild(sel);

  form.appendChild(el('label', {}, 'আইডি/ভোটার/ফর্ম নাম্বার:'));
  form.appendChild(el('input', { name: 'idNumber', class: 'input', required: true, placeholder: 'এখানে নম্বর লিখুন' }));

  form.appendChild(el('label', {}, 'সার্ভিস নাম বা বিশদ:'));
  form.appendChild(el('textarea', { name: 'details', class: 'input', rows: 4, required: true }));

  const submit = el('button', { class: 'btn primary' }, 'অর্ডার করুন');
  form.appendChild(submit);
  card.appendChild(form);
  target.appendChild(card);

  form.onsubmit = async (ev) => {
    ev.preventDefault();
    submit.disabled = true;
    submit.textContent = 'অর্ডার চলছে...';
    try {
      if (!auth.currentUser) { alert('Please login first'); location.href = 'login.html?redirect=' + encodeURIComponent(location.href); return; }
      await ensureUserDoc(auth.currentUser.uid, auth.currentUser.email || '', auth.currentUser.displayName || '');
      const price = Number(service.price || 0);
      const payload = {
        type: form.type.value,
        idNumber: form.idNumber.value,
        details: form.details.value
      };
      await runTransaction(db, async (tx) => {
        const uRef = doc(db, 'users', auth.currentUser.uid);
        const uSnap = await tx.get(uRef);
        if (!uSnap.exists()) throw new Error('Profile missing');
        const bal = Number(uSnap.data().balance || 0);
        if (bal < price) throw new Error('Insufficient balance');
        tx.update(uRef, { balance: bal - price });
        const orderRef = doc(collection(db, 'orders'));
        tx.set(orderRef, {
          userId: auth.currentUser.uid,
          serviceSlug: service.slug,
          serviceTitle: service.title,
          price,
          payload,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      });
      alert('অর্ডার দেওয়া হয়েছে। আপনি অর্ডার তালিকায় দেখতে পাবেন।');
      location.href = 'profile.html';
    } catch (err) {
      alert('Error: ' + (err.message || err));
      console.error(err);
    } finally {
      submit.disabled = false;
      submit.textContent = 'অর্ডার করুন';
    }
  };
}

async function initLogin() {
  const form = q('#loginForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const pass = form.password.value;
    try {
      await setPersistence(auth, browserLocalPersistence); // ✅ ensure session persists
      await signInWithEmailAndPassword(auth, email, pass);
      const redirect = new URLSearchParams(location.search).get('redirect') || 'profile.html';
      location.href = redirect;
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };
}

async function initRegister() {
  const form = q('#registerForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const pass = form.password.value;
    const name = form.name?.value || '';
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', cred.user.uid), { email, fullName: name, balance: 0, role: 'user', createdAt: serverTimestamp() });

      // ✅ Auto-login after registration
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, pass);

      alert('Account created and logged in!');
      location.href = 'profile.html';
    } catch (err) {
      alert('Register failed: ' + err.message);
    }
  };
}

async function initProfile() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { alert('Please login'); location.href = 'login.html'; return; }
    currentUser = user;
    await ensureUserDoc(user.uid, user.email || '', user.displayName || '');
    const uSnap = await getDoc(doc(db, 'users', user.uid));
    const profile = uSnap.exists() ? uSnap.data() : {};
    q('#pf-name').textContent = profile.fullName || user.email || '';
    q('#pf-email').textContent = profile.email || '';
    q('#pf-balance').textContent = tk(profile.balance || 0);

    const ordersRoot = q('#orders-list');
    ordersRoot.innerHTML = 'Loading orders...';
    const qOrders = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(qOrders);
    ordersRoot.innerHTML = '';
    if (snap.empty) { ordersRoot.textContent = 'No orders yet.'; return; }
    snap.forEach(d => {
      const o = d.data();
      const card = el('div', { class: 'order-item' },
        el('div', { class: 'row' }, el('b', {}, o.serviceTitle || '—'), el('span', { class: 'small muted' }, tk(o.price || 0))),
        el('div', { class: 'muted small' }, 'Status: ' + (o.status || 'pending')),
        el('pre', { class: 'payload' }, JSON.stringify(o.payload || {}, null, 2))
      );
      ordersRoot.appendChild(card);
    });
  });
}

/* ---------- Remaining functions (initRecharge, initAdmin) remain unchanged ---------- */
// You can keep the rest of your previous code for initRecharge(), initAdmin(), initService(), etc.  
// Only login, register, profile and auth handling needed fixes.

async function start() {
  onAuthStateChanged(auth, async (u) => {
    currentUser = u;
    await refreshHeaderUI();
  });

  const page = document.body.dataset.page || 'index';

  if (page === 'index') initIndex();
  else if (page === 'service') initService();
  else if (page === 'login') initLogin();
  else if (page === 'register') initRegister();
  else if (page === 'profile') initProfile();
  else if (page === 'recharge') initRecharge();
  else if (page === 'admin') initAdmin();
}

start();
