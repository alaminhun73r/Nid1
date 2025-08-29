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
  serverTimestamp
} from "./firebase-init.js";

/* ---------- Default services fallback (used if Firestore hasn't been seeded) ---------- */
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
function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}
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
    // get user doc for balance & role
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
  // try to fetch from Firestore
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
      el('div', { class: 'card-left' },
         el('div', { class: 'card-icon' }, s.icon || '📦')
      ),
      el('div', { class: 'card-body' },
         el('div', { class: 'card-title' }, s.title),
         el('div', { class: 'card-desc' }, s.desc)
      ),
      el('div', { class: 'card-price' }, tk(s.price || 0))
    );
    out.appendChild(a);
  });
}

async function initService() {
  const slug = getQueryParam('slug') || 'sign-copy';
  const target = q('#service-root');
  target.innerHTML = 'Loading...';
  // fetch from Firestore
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
      // ensure user doc exists
      await ensureUserDoc(auth.currentUser.uid, auth.currentUser.email || '', auth.currentUser.displayName || '');
      const price = Number(service.price || 0);
      const payload = {
        type: form.type.value,
        idNumber: form.idNumber.value,
        details: form.details.value
      };
      // atomic transaction: debit balance and create order
      await runTransaction(db, async (tx) => {
        const uRef = doc(db, 'users', auth.currentUser.uid);
        const uSnap = await tx.get(uRef);
        if (!uSnap.exists()) throw new Error('Profile missing');
        const bal = Number(uSnap.data().balance || 0);
        if (bal < price) throw new Error('Insufficient balance');
        tx.update(uRef, { balance: bal - price });
        const orderRef = doc(collection(db, 'orders')); // new doc ref
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
      await signInWithEmailAndPassword(auth, email, pass);
      // redirect if requested
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
      // create user doc
      await setDoc(doc(db, 'users', cred.user.uid), { email, fullName: name, balance: 0, role: 'user', createdAt: serverTimestamp() });
      alert('Account created. Please login.');
      location.href = 'login.html';
    } catch (err) {
      alert('Register failed: ' + err.message);
    }
  };
}

async function initProfile() {
  if (!auth.currentUser) { alert('Please login'); location.href = 'login.html'; return; }
  // ensure doc exists
  await ensureUserDoc(auth.currentUser.uid, auth.currentUser.email || '', auth.currentUser.displayName || '');
  const uSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
  const profile = uSnap.exists() ? uSnap.data() : {};
  q('#pf-name').textContent = profile.fullName || auth.currentUser.email || '';
  q('#pf-email').textContent = profile.email || '';
  q('#pf-balance').textContent = tk(profile.balance || 0);

  // load orders
  const ordersRoot = q('#orders-list');
  ordersRoot.innerHTML = 'Loading orders...';
  const qOrders = query(collection(db, 'orders'), where('userId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
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
}

async function initRecharge() {
  const form = q('#rechargeForm');
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) { alert('Please login'); location.href = 'login.html'; return; }
    const amount = Number(form.amount.value);
    const trx = form.trx.value.trim();
    const note = form.note.value.trim();
    if (!amount || amount <= 0) { alert('Enter a positive amount'); return; }
    try {
      await addDoc(collection(db, 'recharges'), {
        userId: auth.currentUser.uid,
        amount,
        trxId: trx,
        note,
        method: 'bKash',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      alert('Recharge request submitted. Wait for admin approval.');
      form.reset();
      location.href = 'profile.html';
    } catch (err) {
      alert('Failed: ' + err.message);
    }
  };
}

async function initAdmin() {
  // check admin role
  if (!auth.currentUser) { alert('Please login'); location.href = 'login.html'; return; }
  const meSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
  const me = meSnap.exists() ? meSnap.data() : {};
  if (me.role !== 'admin') { q('#admin-root').innerHTML = '<div class="card">Not authorized. Admins only.</div>'; return; }

  // render admin UI
  const root = q('#admin-root');
  root.innerHTML = '';

  const tabs = el('div', { class: 'tabs' },
    el('button', { id: 't-orders', class: 'tab active' }, 'Orders'),
    el('button', { id: 't-recharges', class: 'tab' }, 'Recharges'),
    el('button', { id: 't-services', class: 'tab' }, 'Services')
  );
  root.appendChild(tabs);

  const container = el('div', { id: 'admin-content' });
  root.appendChild(container);

  q('#t-orders').onclick = () => showTab('orders');
  q('#t-recharges').onclick = () => showTab('recharges');
  q('#t-services').onclick = () => showTab('services');

  async function showTab(name) {
    container.innerHTML = 'Loading...';
    if (name === 'orders') {
      const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
      container.innerHTML = '';
      snap.forEach(d => {
        const o = d.data();
        const elCard = el('div', { class: 'card admin-item' },
          el('div', {}, el('b', {}, o.serviceTitle || '—'), el('span', { class: 'muted small' }, ' — ' + tk(o.price || 0))),
          el('div', { class: 'muted small' }, 'User: ' + (o.userId || '—')),
          el('div', { class: 'muted small' }, 'Status: ' + (o.status || 'pending')),
          el('div', {},
             el('button', { class: 'btn small' , 'data-id': d.id, 'data-status': 'processing' }, 'Processing'),
             el('button', { class: 'btn small', 'data-id': d.id, 'data-status': 'done' }, 'Done'),
             el('button', { class: 'btn small danger', 'data-id': d.id, 'data-status': 'rejected' }, 'Reject')
          )
        );
        container.appendChild(elCard);
      });
      // attach listeners
      container.querySelectorAll('button[data-id]').forEach(b => {
        b.onclick = async () => {
          const id = b.getAttribute('data-id');
          const newStatus = b.getAttribute('data-status');
          await updateDoc(doc(db, 'orders', id), { status: newStatus });
          alert('Updated');
          showTab('orders');
        };
      });
    } else if (name === 'recharges') {
      const snap = await getDocs(query(collection(db, 'recharges'), orderBy('createdAt', 'desc')));
      container.innerHTML = '';
      snap.forEach(d => {
        const r = d.data();
        const rCard = el('div', { class: 'card admin-item' },
          el('div', {}, el('b', {}, tk(r.amount || 0)), ' — ', r.method || '—'),
          el('div', { class: 'muted small' }, 'User: ' + (r.userId || '—') + (r.trxId ? ' — Trx:' + r.trxId : '')),
          el('div', { class: 'muted small' }, 'Status: ' + (r.status || 'pending')),
          el('div', {}, (r.status === 'pending') ? el('button', { class: 'btn small', 'data-id': d.id }, 'Approve') : el('span', { class: 'muted small' }, '—'))
        );
        container.appendChild(rCard);
      });
      // approve listener
      container.querySelectorAll('button[data-id]').forEach(b => {
        b.onclick = async () => {
          if (!confirm('Approve this recharge and credit user?')) return;
          const id = b.getAttribute('data-id');
          try {
            await runTransaction(db, async (tx) => {
              const rRef = doc(db, 'recharges', id);
              const rSnap = await tx.get(rRef);
              if (!rSnap.exists()) throw new Error('Recharge missing');
              if (rSnap.data().status !== 'pending') return;
              const uid = rSnap.data().userId;
              const amt = Number(rSnap.data().amount || 0);
              const uRef = doc(db, 'users', uid);
              const uSnap = await tx.get(uRef);
              if (!uSnap.exists()) throw new Error('User missing');
              const newBal = (Number(uSnap.data().balance || 0) + amt);
              tx.update(uRef, { balance: newBal });
              tx.update(rRef, { status: 'approved' });
            });
            alert('Approved & credited');
            showTab('recharges');
          } catch (err) {
            alert('Failed: ' + err.message);
            console.error(err);
          }
        };
      });
    } else if (name === 'services') {
      // list services and add form
      const snap = await getDocs(query(collection(db, 'services'), orderBy('slug', 'asc')));
      container.innerHTML = '';
      const addForm = el('form', { id: 'addServiceForm', class: 'card' },
        el('h3', {}, 'Add Service'),
        el('input', { name: 'title', placeholder: 'Title', class: 'input', required: true }),
        el('input', { name: 'slug', placeholder: 'slug (unique)', class: 'input', required: true }),
        el('input', { name: 'price', placeholder: 'price (number)', class: 'input', required: true, type: 'number' }),
        el('input', { name: 'color', placeholder: 'css color var or hex', class: 'input' , value: 'var(--green)'}),
        el('button', { class: 'btn' }, 'Save')
      );
      container.appendChild(addForm);

      const listNode = el('div', {});
      container.appendChild(listNode);
      snap.forEach(d => {
        const s = d.data();
        const one = el('div', { class: 'card admin-item' },
          el('b', {}, s.title || ''),
          el('div', { class: 'muted small' }, s.slug + ' — ' + tk(s.price || 0))
        );
        listNode.appendChild(one);
      });

      addForm.onsubmit = async (ev) => {
        ev.preventDefault();
        const fd = new FormData(addForm);
        const title = fd.get('title');
        const slug = fd.get('slug');
        const price = Number(fd.get('price') || 0);
        const color = fd.get('color') || 'var(--green)';
        try {
          await addDoc(collection(db, 'services'), { title, slug, price, color, desc: '', createdAt: serverTimestamp() });
          alert('Service added');
          showTab('services');
        } catch (err) {
          alert('Failed: ' + err.message);
        }
      };
    }
  }

  // initial tab
  showTab('orders');
}

/* ---------- Main router ---------- */
function start() {
  // watch auth
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
