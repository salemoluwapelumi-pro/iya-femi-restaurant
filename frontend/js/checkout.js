let ZONES = [];

function selectedZone() {
  const id = Number(document.getElementById('delivery_zone').value);
  return ZONES.find((z) => z.id === id) || null;
}

function isDelivery() {
  return document.querySelector('input[name="order_type"]:checked').value === 'delivery';
}

function renderSummary() {
  const items = Cart.read();
  const table = document.getElementById('summary-table');
  if (!items.length) {
    table.innerHTML = '<tr><td class="empty-state">Your cart is empty. <a href="/menu.html">Browse the menu</a></td></tr>';
    document.getElementById('place-order-btn').disabled = true;
    return;
  }
  document.getElementById('place-order-btn').disabled = false;
  const subtotal = Cart.subtotal();
  const fee = isDelivery() && selectedZone() ? Number(selectedZone().fee) : 0;
  table.innerHTML = `
    ${items.map((i) => `<tr><td>${escapeHtml(i.name)} × ${i.qty}</td><td>${naira(i.price * i.qty)}</td></tr>`).join('')}
    <tr><td>Subtotal</td><td>${naira(subtotal)}</td></tr>
    <tr><td>Delivery fee</td><td>${isDelivery() ? naira(fee) : '—'}</td></tr>
    <tr><th>Total</th><th>${naira(subtotal + fee)}</th></tr>`;
}

function showAlert(message, type = 'error') {
  const el = document.getElementById('checkout-alert');
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function loadZones() {
  const select = document.getElementById('delivery_zone');
  try {
    ZONES = await API.get('/delivery-zones');
    select.innerHTML = ZONES.map((z) => `<option value="${z.id}">${escapeHtml(z.name)} — ${naira(z.fee)}</option>`).join('');
    updateZoneAreas();
  } catch {
    select.innerHTML = '<option value="">Could not load zones</option>';
  }
  renderSummary();
}

function updateZoneAreas() {
  const zone = selectedZone();
  document.getElementById('zone-areas').textContent = zone ? `Covers: ${zone.areas}` : '';
}

document.getElementById('delivery_zone').addEventListener('change', () => { updateZoneAreas(); renderSummary(); });
document.querySelectorAll('input[name="order_type"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.getElementById('delivery-fields').classList.toggle('hidden', !isDelivery());
    renderSummary();
  });
});

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = Cart.read();
  if (!items.length) return showAlert('Your cart is empty. Add meals from the menu first.');

  const name = document.getElementById('customer_name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  if (!name) return showAlert('Please enter your full name.');
  if (!/^(\+234|0)[0-9]{10}$/.test(phone.replace(/[\s-]/g, ''))) {
    return showAlert('Please enter a valid Nigerian phone number, e.g. 08065249697.');
  }
  if (isDelivery()) {
    if (!document.getElementById('delivery_zone').value) return showAlert('Please select a delivery zone.');
    if (!document.getElementById('delivery_address').value.trim()) return showAlert('Please enter your delivery address.');
  }

  const payload = {
    customer_name: name,
    phone,
    email: document.getElementById('email').value.trim(),
    order_type: document.querySelector('input[name="order_type"]:checked').value,
    payment_method: document.querySelector('input[name="payment_method"]:checked').value,
    notes: document.getElementById('notes').value.trim(),
    items: items.map((i) => ({ menu_item_id: i.id, quantity: i.qty })),
  };
  if (isDelivery()) {
    payload.delivery_zone_id = Number(document.getElementById('delivery_zone').value);
    payload.delivery_address = document.getElementById('delivery_address').value.trim();
    payload.delivery_instructions = document.getElementById('delivery_instructions').value.trim();
  }

  const btn = document.getElementById('place-order-btn');
  btn.disabled = true;
  btn.textContent = 'Placing order…';
  try {
    const order = await API.post('/orders', payload);
    Cart.clear();
    document.getElementById('checkout-wrap').classList.add('hidden');
    document.getElementById('checkout-alert').className = 'hidden';
    document.getElementById('confirmation').classList.remove('hidden');
    document.getElementById('conf-number').textContent = order.order_number;
    document.getElementById('conf-table').innerHTML = `
      <tr><td>Subtotal</td><td>${naira(order.subtotal)}</td></tr>
      <tr><td>Delivery fee</td><td>${naira(order.delivery_fee)}</td></tr>
      <tr><th>Total to pay</th><th>${naira(order.total)}</th></tr>
      <tr><td>Payment</td><td>${order.payment_method === 'bank_transfer' ? 'Bank transfer' : 'Cash'}</td></tr>`;
    if (order.bank_details) {
      document.getElementById('conf-bank').classList.remove('hidden');
      document.getElementById('conf-bank-table').innerHTML = `
        <tr><td>Bank</td><td>${escapeHtml(order.bank_details.bank_name)}</td></tr>
        <tr><td>Account name</td><td>${escapeHtml(order.bank_details.account_name)}</td></tr>
        <tr><td>Account number</td><td>${escapeHtml(order.bank_details.account_number)}</td></tr>`;
    }
    document.getElementById('conf-track-link').href =
      `/track.html?order=${encodeURIComponent(order.order_number)}&phone=${encodeURIComponent(phone)}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showAlert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
});

initLayout('checkout');
loadZones();
