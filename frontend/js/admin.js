// Iya Femi Admin dashboard SPA.
const TOKEN_KEY = 'iyafemi_admin_token';

const AdminAPI = {
  async request(path, options = {}) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api${path}`, { ...options, headers });
    if (res.status === 401 && path !== '/auth/login') {
      logout();
      throw new Error('Session expired. Please sign in again.');
    }
    let body;
    try { body = await res.json(); } catch { throw new Error('Unexpected server response'); }
    if (!res.ok || !body.success) throw new Error(body.error || 'Request failed');
    return body.data;
  },
  get(p) { return this.request(p); },
  post(p, d) { return this.request(p, { method: 'POST', body: JSON.stringify(d) }); },
  put(p, d) { return this.request(p, { method: 'PUT', body: JSON.stringify(d) }); },
  patch(p, d) { return this.request(p, { method: 'PATCH', body: JSON.stringify(d) }); },
  del(p) { return this.request(p, { method: 'DELETE' }); },
  upload(p, formData) { return this.request(p, { method: 'POST', body: formData }); },
};

// ---------- Auth ----------
function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem('iyafemi_admin_name');
  document.getElementById('admin-view').classList.add('hidden');
  document.getElementById('login-view').classList.remove('hidden');
}

function showAdmin() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('admin-view').classList.remove('hidden');
  document.getElementById('admin-name').textContent = sessionStorage.getItem('iyafemi_admin_name') || '';
  openTab('dashboard');
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('login-alert');
  alertEl.className = 'hidden';
  try {
    const data = await AdminAPI.post('/auth/login', {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value,
    });
    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem('iyafemi_admin_name', data.admin.name);
    showAdmin();
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
});

// ---------- Tabs ----------
const main = document.getElementById('admin-main');
const TABS = {};

function openTab(tab) {
  document.querySelectorAll('#admin-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  main.innerHTML = '<div class="loading"><div class="spinner"></div>Loading…</div>';
  TABS[tab]().catch((err) => {
    main.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  });
}
document.getElementById('admin-nav').addEventListener('click', (e) => {
  if (e.target.dataset.tab) openTab(e.target.dataset.tab);
});

// ---------- Modal ----------
const overlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
function openModal(html) { modalContent.innerHTML = html; overlay.classList.add('open'); }
function closeModal() { overlay.classList.remove('open'); modalContent.innerHTML = ''; }
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

const paymentPill = (s) => `<span class="pill pill-${escapeHtml(s)}">${escapeHtml(s)}</span>`;
const dt = (iso) => new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

// ---------- Dashboard ----------
TABS.dashboard = async () => {
  const d = await AdminAPI.get('/admin/dashboard');
  main.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-value">${d.today.orders}</div><div class="stat-label">Orders today</div></div>
      <div class="stat-card"><div class="stat-value">${naira(d.today.revenue)}</div><div class="stat-label">Paid revenue today</div></div>
      <div class="stat-card"><div class="stat-value">${d.pending_orders}</div><div class="stat-label">Pending orders</div></div>
      <div class="stat-card"><div class="stat-value">${d.customer_count}</div><div class="stat-label">Customers (all time)</div></div>
    </div>
    <div class="form-grid">
      <div>
        <h2 style="font-size:1.1rem">Recent Orders</h2>
        <div class="table-scroll"><table class="data-table">
          <tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Payment</th></tr>
          ${d.recent_orders.map((o) => `<tr>
            <td>${escapeHtml(o.order_number)}</td><td>${escapeHtml(o.customer_name)}</td>
            <td>${naira(o.total)}</td><td>${escapeHtml(o.status)}</td><td>${paymentPill(o.payment_status)}</td>
          </tr>`).join('') || '<tr><td colspan="5">No orders yet</td></tr>'}
        </table></div>
      </div>
      <div>
        <h2 style="font-size:1.1rem">Popular Meals</h2>
        <div class="table-scroll"><table class="data-table">
          <tr><th>Meal</th><th>Sold</th></tr>
          ${d.popular_items.map((p) => `<tr><td>${escapeHtml(p.item_name)}</td><td>${p.sold}</td></tr>`).join('') || '<tr><td colspan="2">No sales yet</td></tr>'}
        </table></div>
        ${d.unavailable_items.length ? `
          <h2 style="font-size:1.1rem;margin-top:1.25rem">Unavailable Items</h2>
          <div class="alert alert-info">${d.unavailable_items.map(escapeHtml).join(', ')}</div>` : ''}
      </div>
    </div>`;
};

// ---------- Orders ----------
const ORDER_STATUSES = ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'ready_for_pickup', 'collected', 'cancelled', 'rejected'];

TABS.orders = async (filter = '') => {
  const orders = await AdminAPI.get(`/admin/orders${filter ? `?status=${filter}` : ''}`);
  main.innerHTML = `
    <div class="section-head">
      <h2 style="margin:0">Orders</h2>
      <select id="order-filter" class="status-select">
        <option value="">All statuses</option>
        ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === filter ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="table-scroll"><table class="data-table">
      <tr><th>Order</th><th>Time</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th><th>Payment</th><th></th></tr>
      ${orders.map((o) => `<tr>
        <td>${escapeHtml(o.order_number)}</td>
        <td>${dt(o.created_at)}</td>
        <td>${escapeHtml(o.customer_name)}<br><a href="tel:${escapeHtml(o.phone)}" class="muted">${escapeHtml(o.phone)}</a></td>
        <td>${escapeHtml(o.order_type)}</td>
        <td>${naira(o.total)}</td>
        <td>
          <select class="status-select" data-prev="${o.status}" onchange="changeOrderStatus(${o.id}, this.value, this)">
            ${ORDER_STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td>${paymentPill(o.payment_status)}</td>
        <td><button class="btn btn-sm btn-green" onclick="viewOrder(${o.id})">View</button></td>
      </tr>`).join('') || '<tr><td colspan="8">No orders found</td></tr>'}
    </table></div>`;
  document.getElementById('order-filter').addEventListener('change', (e) => TABS.orders(e.target.value));
};

async function changeOrderStatus(id, status, el) {
  try {
    await AdminAPI.patch(`/admin/orders/${id}/status`, { status });
    el.dataset.prev = status;
    showToast(`Order status updated to ${status}`);
  } catch (err) {
    showToast(err.message);
    el.value = el.dataset.prev || 'received';
  }
}

async function viewOrder(id) {
  const o = await AdminAPI.get(`/admin/orders/${id}`);
  openModal(`
    <h2>Order ${escapeHtml(o.order_number)}</h2>
    <p><strong>${escapeHtml(o.customer_name)}</strong> — <a href="tel:${escapeHtml(o.phone)}">${escapeHtml(o.phone)}</a>
       ${o.email ? ` — ${escapeHtml(o.email)}` : ''}</p>
    <p>Type: <strong>${escapeHtml(o.order_type)}</strong>
       ${o.order_type === 'delivery' ? `<br>Zone: ${escapeHtml(o.zone_name || '-')}<br>Address: ${escapeHtml(o.delivery_address)}
       ${o.delivery_instructions ? `<br>Instructions: ${escapeHtml(o.delivery_instructions)}` : ''}` : ''}
       ${o.notes ? `<br>Notes: ${escapeHtml(o.notes)}` : ''}</p>
    <table class="summary-table">
      ${o.items.map((i) => `<tr><td>${escapeHtml(i.item_name)} × ${i.quantity}</td><td>${naira(i.line_total)}</td></tr>`).join('')}
      <tr><td>Subtotal</td><td>${naira(o.subtotal)}</td></tr>
      <tr><td>Delivery fee</td><td>${naira(o.delivery_fee)}</td></tr>
      <tr><th>Total</th><th>${naira(o.total)}</th></tr>
    </table>
    <p>Payment: ${paymentPill(o.payment_status)} via <strong>${escapeHtml(o.payment_method)}</strong></p>
    ${o.payments.length ? `<p class="muted">References: ${o.payments.map((p) => escapeHtml(p.reference)).join(', ')}</p>` : ''}
    <h3 style="font-size:1rem">Record payment verification</h3>
    <div class="form-group"><input type="text" id="pay-ref" placeholder="Transaction reference (from bank alert/receipt)"></div>
    <div class="modal-actions">
      <button class="btn btn-sm btn-danger" onclick="recordPayment(${o.id}, 'failed')">Mark Failed</button>
      <button class="btn btn-sm btn-green" onclick="recordPayment(${o.id}, 'paid')">Mark Paid</button>
      <button class="btn btn-sm btn-primary" onclick="closeModal()">Close</button>
    </div>`);
}

async function recordPayment(orderId, status) {
  const reference = document.getElementById('pay-ref').value.trim();
  if (!reference) return showToast('Enter the payment transaction reference first');
  try {
    await AdminAPI.post(`/admin/orders/${orderId}/payment`, { reference, status });
    showToast(`Payment marked ${status}`);
    closeModal();
    TABS.orders();
  } catch (err) {
    showToast(err.message);
  }
}

// ---------- Menu ----------
let CATEGORIES_CACHE = [];

TABS.menu = async () => {
  const [items, cats] = await Promise.all([AdminAPI.get('/admin/menu'), AdminAPI.get('/admin/categories')]);
  CATEGORIES_CACHE = cats;
  main.innerHTML = `
    <div class="section-head">
      <h2 style="margin:0">Menu Items</h2>
      <button class="btn btn-green btn-sm" onclick="editMenuItem()">+ Add Item</button>
    </div>
    <div class="table-scroll"><table class="data-table">
      <tr><th>Name</th><th>Category</th><th>Price</th><th>Available</th><th>Featured</th><th></th></tr>
      ${items.map((m) => `<tr>
        <td>${escapeHtml(m.name)}</td>
        <td>${escapeHtml(m.category_name)}</td>
        <td>${naira(m.price)}</td>
        <td><button class="btn btn-sm ${m.available ? 'btn-green' : 'btn-danger'}" onclick="toggleAvail(${m.id})">${m.available ? 'Available' : 'Unavailable'}</button></td>
        <td>${m.featured ? '⭐' : ''}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='editMenuItem(${JSON.stringify(m).replace(/'/g, '&#39;')})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="archiveItem(${m.id}, '${escapeHtml(m.name).replace(/'/g, '&#39;')}')">Archive</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="6">No menu items</td></tr>'}
    </table></div>`;
};

async function toggleAvail(id) {
  try {
    const r = await AdminAPI.patch(`/admin/menu/${id}/availability`, {});
    showToast(`"${r.name}" is now ${r.available ? 'available' : 'unavailable'}`);
    TABS.menu();
  } catch (err) { showToast(err.message); }
}

async function archiveItem(id, name) {
  if (!confirm(`Archive "${name}"? It will be hidden from the menu.`)) return;
  try {
    await AdminAPI.del(`/admin/menu/${id}`);
    showToast('Item archived');
    TABS.menu();
  } catch (err) { showToast(err.message); }
}

function editMenuItem(item) {
  const m = item || {};
  openModal(`
    <h2>${m.id ? 'Edit' : 'Add'} Menu Item</h2>
    <div class="form-grid">
      <div class="form-group"><label>Name *</label><input type="text" id="mi-name" value="${escapeHtml(m.name || '')}" maxlength="140"></div>
      <div class="form-group"><label>Category *</label>
        <select id="mi-category">${CATEGORIES_CACHE.map((c) => `<option value="${c.id}" ${c.id === m.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Price (₦) *</label><input type="number" id="mi-price" min="0" step="50" value="${m.price ?? ''}"></div>
      <div class="form-group"><label>Portion info</label><input type="text" id="mi-portion" value="${escapeHtml(m.portion_info || '')}" maxlength="140" placeholder="e.g. Per portion"></div>
    </div>
    <div class="form-group"><label>Description</label><textarea id="mi-desc" rows="2" maxlength="2000">${escapeHtml(m.description || '')}</textarea></div>
    <div class="form-group"><label>Ingredients</label><input type="text" id="mi-ingredients" value="${escapeHtml(m.ingredients || '')}" maxlength="2000"></div>
    <div class="form-group">
      <label>Image</label>
      <input type="file" id="mi-image-file" accept="image/jpeg,image/png,image/webp">
      <input type="hidden" id="mi-image" value="${escapeHtml(m.image_url || '')}">
      ${m.image_url ? `<p class="muted" style="font-size:0.8rem">Current: ${escapeHtml(m.image_url)}</p>` : ''}
    </div>
    <div class="form-grid">
      <label><input type="checkbox" id="mi-available" ${m.available !== false ? 'checked' : ''}> Available</label>
      <label><input type="checkbox" id="mi-featured" ${m.featured ? 'checked' : ''}> Featured on homepage</label>
    </div>
    <div id="mi-alert" class="hidden"></div>
    <div class="modal-actions">
      <button class="btn btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-sm btn-green" onclick="saveMenuItem(${m.id || 'null'})">Save</button>
    </div>`);
}

async function saveMenuItem(id) {
  const alertEl = document.getElementById('mi-alert');
  try {
    let imageUrl = document.getElementById('mi-image').value;
    const fileInput = document.getElementById('mi-image-file');
    if (fileInput.files.length) {
      const fd = new FormData();
      fd.append('image', fileInput.files[0]);
      const uploaded = await AdminAPI.upload('/admin/upload', fd);
      imageUrl = uploaded.url;
    }
    const payload = {
      name: document.getElementById('mi-name').value.trim(),
      category_id: Number(document.getElementById('mi-category').value),
      price: Number(document.getElementById('mi-price').value),
      portion_info: document.getElementById('mi-portion').value.trim(),
      description: document.getElementById('mi-desc').value.trim(),
      ingredients: document.getElementById('mi-ingredients').value.trim(),
      image_url: imageUrl,
      available: document.getElementById('mi-available').checked,
      featured: document.getElementById('mi-featured').checked,
    };
    if (id) await AdminAPI.put(`/admin/menu/${id}`, payload);
    else await AdminAPI.post('/admin/menu', payload);
    showToast('Menu item saved');
    closeModal();
    TABS.menu();
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
}

// ---------- Categories ----------
TABS.categories = async () => {
  const cats = await AdminAPI.get('/admin/categories');
  main.innerHTML = `
    <div class="section-head">
      <h2 style="margin:0">Categories</h2>
      <button class="btn btn-green btn-sm" onclick="editCategory()">+ Add Category</button>
    </div>
    <div class="table-scroll"><table class="data-table">
      <tr><th>Name</th><th>Order</th><th>Active</th><th></th></tr>
      ${cats.map((c) => `<tr>
        <td>${escapeHtml(c.name)}</td><td>${c.display_order}</td><td>${c.active ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='editCategory(${JSON.stringify(c).replace(/'/g, '&#39;')})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">Delete</button>
        </td>
      </tr>`).join('')}
    </table></div>`;
};

function editCategory(cat) {
  const c = cat || {};
  openModal(`
    <h2>${c.id ? 'Edit' : 'Add'} Category</h2>
    <div class="form-group"><label>Name *</label><input type="text" id="cat-name" value="${escapeHtml(c.name || '')}" maxlength="80"></div>
    <div class="form-group"><label>Display order</label><input type="number" id="cat-order" value="${c.display_order ?? 0}"></div>
    ${c.id ? `<label><input type="checkbox" id="cat-active" ${c.active ? 'checked' : ''}> Active (visible to customers)</label>` : ''}
    <div id="cat-alert" class="hidden"></div>
    <div class="modal-actions">
      <button class="btn btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-sm btn-green" onclick="saveCategory(${c.id || 'null'})">Save</button>
    </div>`);
}

async function saveCategory(id) {
  const alertEl = document.getElementById('cat-alert');
  const payload = {
    name: document.getElementById('cat-name').value.trim(),
    display_order: Number(document.getElementById('cat-order').value) || 0,
  };
  if (id) payload.active = document.getElementById('cat-active').checked;
  try {
    if (id) await AdminAPI.put(`/admin/categories/${id}`, payload);
    else await AdminAPI.post('/admin/categories', payload);
    showToast('Category saved');
    closeModal();
    TABS.categories();
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await AdminAPI.del(`/admin/categories/${id}`);
    showToast('Category deleted');
    TABS.categories();
  } catch (err) { showToast(err.message); }
}

// ---------- Delivery zones ----------
TABS.zones = async () => {
  const zones = await AdminAPI.get('/admin/delivery-zones');
  main.innerHTML = `
    <div class="section-head">
      <h2 style="margin:0">Delivery Zones & Fees</h2>
      <button class="btn btn-green btn-sm" onclick="editZone()">+ Add Zone</button>
    </div>
    <div class="table-scroll"><table class="data-table">
      <tr><th>Zone</th><th>Areas covered</th><th>Fee</th><th>Active</th><th></th></tr>
      ${zones.map((z) => `<tr>
        <td>${escapeHtml(z.name)}</td><td>${escapeHtml(z.areas)}</td><td>${naira(z.fee)}</td><td>${z.active ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick='editZone(${JSON.stringify(z).replace(/'/g, '&#39;')})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteZone(${z.id})">Delete</button>
        </td>
      </tr>`).join('')}
    </table></div>`;
};

function editZone(zone) {
  const z = zone || {};
  openModal(`
    <h2>${z.id ? 'Edit' : 'Add'} Delivery Zone</h2>
    <div class="form-group"><label>Zone name *</label><input type="text" id="zone-name" value="${escapeHtml(z.name || '')}" maxlength="120"></div>
    <div class="form-group"><label>Areas covered</label><textarea id="zone-areas-input" rows="2" maxlength="1000">${escapeHtml(z.areas || '')}</textarea></div>
    <div class="form-group"><label>Delivery fee (₦) *</label><input type="number" id="zone-fee" min="0" step="100" value="${z.fee ?? ''}"></div>
    ${z.id ? `<label><input type="checkbox" id="zone-active" ${z.active ? 'checked' : ''}> Active</label>` : ''}
    <div id="zone-alert" class="hidden"></div>
    <div class="modal-actions">
      <button class="btn btn-sm" onclick="closeModal()">Cancel</button>
      <button class="btn btn-sm btn-green" onclick="saveZone(${z.id || 'null'})">Save</button>
    </div>`);
}

async function saveZone(id) {
  const alertEl = document.getElementById('zone-alert');
  const payload = {
    name: document.getElementById('zone-name').value.trim(),
    areas: document.getElementById('zone-areas-input').value.trim(),
    fee: Number(document.getElementById('zone-fee').value),
  };
  if (id) payload.active = document.getElementById('zone-active').checked;
  try {
    if (id) await AdminAPI.put(`/admin/delivery-zones/${id}`, payload);
    else await AdminAPI.post('/admin/delivery-zones', payload);
    showToast('Zone saved');
    closeModal();
    TABS.zones();
  } catch (err) {
    alertEl.className = 'alert alert-error';
    alertEl.textContent = err.message;
  }
}

async function deleteZone(id) {
  if (!confirm('Delete this delivery zone?')) return;
  try {
    await AdminAPI.del(`/admin/delivery-zones/${id}`);
    showToast('Zone deleted');
    TABS.zones();
  } catch (err) { showToast(err.message); }
}

// ---------- Reviews ----------
TABS.reviews = async () => {
  const reviews = await AdminAPI.get('/admin/reviews');
  main.innerHTML = `
    <h2>Customer Reviews</h2>
    <div class="table-scroll"><table class="data-table">
      <tr><th>Date</th><th>Name</th><th>Rating</th><th>Comment</th><th>Verified</th><th>Status</th><th></th></tr>
      ${reviews.map((r) => `<tr>
        <td>${dt(r.created_at)}</td>
        <td>${escapeHtml(r.customer_name)}</td>
        <td><span class="stars">${'★'.repeat(r.rating)}</span></td>
        <td>${escapeHtml(r.comment)}</td>
        <td>${r.order_id ? '✔' : ''}</td>
        <td>${r.approved ? '<span class="pill pill-paid">visible</span>' : '<span class="pill pill-pending">pending</span>'}</td>
        <td>
          <button class="btn btn-sm ${r.approved ? 'btn-primary' : 'btn-green'}" onclick="moderateReview(${r.id}, ${!r.approved})">${r.approved ? 'Hide' : 'Approve'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteReview(${r.id})">Delete</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="7">No reviews yet</td></tr>'}
    </table></div>`;
};

async function moderateReview(id, approved) {
  try {
    await AdminAPI.patch(`/admin/reviews/${id}`, { approved });
    showToast(approved ? 'Review approved' : 'Review hidden');
    TABS.reviews();
  } catch (err) { showToast(err.message); }
}

async function deleteReview(id) {
  if (!confirm('Delete this review permanently?')) return;
  try {
    await AdminAPI.del(`/admin/reviews/${id}`);
    showToast('Review deleted');
    TABS.reviews();
  } catch (err) { showToast(err.message); }
}

// ---------- Settings ----------
const DAYS = [['monday','Mon'],['tuesday','Tue'],['wednesday','Wed'],['thursday','Thu'],['friday','Fri'],['saturday','Sat'],['sunday','Sun']];

TABS.settings = async () => {
  const s = await AdminAPI.get('/admin/settings');
  let hours = {};
  try { hours = JSON.parse(s.opening_hours || '{}'); } catch { /* default */ }
  const text = (id, label, key, placeholder = '') => `
    <div class="form-group"><label>${label}</label>
      <input type="text" id="${id}" value="${escapeHtml(s[key] || '')}" placeholder="${placeholder}"></div>`;
  main.innerHTML = `
    <h2>Restaurant Settings</h2>
    <div id="settings-alert" class="hidden"></div>
    <form id="settings-form">
      <h3 style="font-size:1.05rem">Business Information</h3>
      <div class="form-grid">
        ${text('s-name', 'Restaurant name', 'restaurant_name')}
        ${text('s-tagline', 'Tagline', 'tagline')}
        ${text('s-phone1', 'Primary phone', 'phone_primary')}
        ${text('s-phone2', 'Secondary phone', 'phone_secondary')}
        ${text('s-phone3', 'Third phone', 'phone_tertiary')}
        ${text('s-whatsapp', 'WhatsApp number', 'whatsapp_number', '+234...')}
        ${text('s-email', 'Email', 'email')}
        ${text('s-maps', 'Google Maps search query', 'maps_query')}
      </div>
      <div class="form-group"><label>Address</label><textarea id="s-address" rows="2">${escapeHtml(s.address || '')}</textarea></div>
      <div class="form-group"><label>Description</label><textarea id="s-description" rows="3">${escapeHtml(s.description || '')}</textarea></div>

      <h3 style="font-size:1.05rem">Bank Account for Transfers</h3>
      <p class="muted" style="font-size:0.85rem">Shown to customers who choose bank transfer at checkout. Placeholders are used until you fill these in.</p>
      <div class="form-grid">
        ${text('s-bank-name', 'Bank name', 'bank_name')}
        ${text('s-bank-account-name', 'Account name', 'bank_account_name')}
        ${text('s-bank-account-number', 'Account number', 'bank_account_number')}
      </div>

      <h3 style="font-size:1.05rem">Ordering</h3>
      <div class="form-grid">
        <div class="form-group"><label>Minimum order (₦)</label><input type="number" id="s-minimum" min="0" value="${escapeHtml(s.minimum_order || '0')}"></div>
        <div class="form-group"><label>Online ordering</label>
          <select id="s-ordering"><option value="true" ${s.ordering_enabled === 'true' ? 'selected' : ''}>Enabled</option>
          <option value="false" ${s.ordering_enabled !== 'true' ? 'selected' : ''}>Disabled</option></select></div>
      </div>

      <h3 style="font-size:1.05rem">Opening Hours</h3>
      <div class="hours-editor">
        ${DAYS.map(([key, label]) => {
          const d = hours[key] || { open: '08:00', close: '21:00', closed: false };
          return `<div class="hours-row">
            <strong>${label}</strong>
            <input type="time" id="h-${key}-open" value="${d.open}">
            <input type="time" id="h-${key}-close" value="${d.close}">
            <label style="font-size:0.85rem"><input type="checkbox" id="h-${key}-closed" ${d.closed ? 'checked' : ''}> Closed</label>
          </div>`;
        }).join('')}
      </div>

      <h3 style="font-size:1.05rem">Social Media</h3>
      <div class="form-grid">
        ${text('s-facebook', 'Facebook URL', 'facebook_url')}
        ${text('s-instagram', 'Instagram URL', 'instagram_url')}
        ${text('s-tiktok', 'TikTok URL', 'tiktok_url')}
      </div>

      <button type="submit" class="btn btn-green" style="margin-top:1rem">Save Settings</button>
    </form>`;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const hoursOut = {};
    for (const [key] of DAYS) {
      hoursOut[key] = {
        open: document.getElementById(`h-${key}-open`).value,
        close: document.getElementById(`h-${key}-close`).value,
        closed: document.getElementById(`h-${key}-closed`).checked,
      };
    }
    const payload = {
      restaurant_name: document.getElementById('s-name').value.trim(),
      tagline: document.getElementById('s-tagline').value.trim(),
      description: document.getElementById('s-description').value.trim(),
      address: document.getElementById('s-address').value.trim(),
      phone_primary: document.getElementById('s-phone1').value.trim(),
      phone_secondary: document.getElementById('s-phone2').value.trim(),
      phone_tertiary: document.getElementById('s-phone3').value.trim(),
      whatsapp_number: document.getElementById('s-whatsapp').value.trim(),
      email: document.getElementById('s-email').value.trim(),
      maps_query: document.getElementById('s-maps').value.trim(),
      bank_name: document.getElementById('s-bank-name').value.trim(),
      bank_account_name: document.getElementById('s-bank-account-name').value.trim(),
      bank_account_number: document.getElementById('s-bank-account-number').value.trim(),
      minimum_order: document.getElementById('s-minimum').value,
      ordering_enabled: document.getElementById('s-ordering').value,
      opening_hours: JSON.stringify(hoursOut),
      facebook_url: document.getElementById('s-facebook').value.trim(),
      instagram_url: document.getElementById('s-instagram').value.trim(),
      tiktok_url: document.getElementById('s-tiktok').value.trim(),
    };
    const alertEl = document.getElementById('settings-alert');
    try {
      await AdminAPI.put('/admin/settings', payload);
      alertEl.className = 'alert alert-success';
      alertEl.textContent = 'Settings saved successfully.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      alertEl.className = 'alert alert-error';
      alertEl.textContent = err.message;
    }
  });
};

// ---------- Audit log ----------
TABS.audit = async () => {
  const logs = await AdminAPI.get('/admin/audit-log');
  main.innerHTML = `
    <h2>Audit Log</h2>
    <div class="table-scroll"><table class="data-table">
      <tr><th>Time</th><th>Admin</th><th>Action</th><th>Details</th></tr>
      ${logs.map((l) => `<tr>
        <td>${dt(l.created_at)}</td><td>${escapeHtml(l.admin_name || 'system')}</td>
        <td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.details)}</td>
      </tr>`).join('') || '<tr><td colspan="4">No activity yet</td></tr>'}
    </table></div>`;
};

// ---------- Boot ----------
if (sessionStorage.getItem(TOKEN_KEY)) showAdmin();
