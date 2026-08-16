const DELIVERY_STEPS = [
  ['received', 'Order received'], ['confirmed', 'Confirmed'], ['preparing', 'Preparing'],
  ['ready', 'Ready'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered'],
];
const PICKUP_STEPS = [
  ['received', 'Order received'], ['confirmed', 'Confirmed'], ['preparing', 'Preparing'],
  ['ready_for_pickup', 'Ready for pickup'], ['collected', 'Collected'],
];
const STATUS_LABELS = Object.fromEntries([...DELIVERY_STEPS, ...PICKUP_STEPS, ['cancelled', 'Cancelled'], ['rejected', 'Rejected'], ['ready', 'Ready']]);

async function track(orderNumber, phone) {
  const errorEl = document.getElementById('track-error');
  const resultEl = document.getElementById('track-result');
  errorEl.className = 'hidden';
  resultEl.classList.add('hidden');
  const btn = document.getElementById('track-btn');
  btn.disabled = true;
  btn.textContent = 'Searching…';
  try {
    const order = await API.get(`/orders/track/${encodeURIComponent(orderNumber)}?phone=${encodeURIComponent(phone)}`);
    document.getElementById('result-number').textContent = order.order_number;
    document.getElementById('result-status').textContent = STATUS_LABELS[order.status] || order.status;
    document.getElementById('result-payment').textContent = `Payment: ${order.payment_status}`;

    const steps = order.order_type === 'delivery' ? DELIVERY_STEPS : PICKUP_STEPS;
    const timeline = document.getElementById('result-timeline');
    if (['cancelled', 'rejected'].includes(order.status)) {
      timeline.innerHTML = `<li class="current"><span class="t-label">${STATUS_LABELS[order.status]}</span></li>`;
    } else {
      const reachedIdx = steps.findIndex(([key]) => key === order.status);
      const timeByStatus = Object.fromEntries(order.history.map((h) => [h.status, h.created_at]));
      timeline.innerHTML = steps.map(([key, label], idx) => {
        const cls = idx < reachedIdx ? 'done' : idx === reachedIdx ? 'current' : '';
        const time = timeByStatus[key] ? new Date(timeByStatus[key]).toLocaleString('en-NG') : '';
        return `<li class="${cls}"><span class="t-label">${label}</span><br><span class="t-time">${time}</span></li>`;
      }).join('');
    }

    document.getElementById('result-items').innerHTML = `
      ${order.items.map((i) => `<tr><td>${escapeHtml(i.item_name)} × ${i.quantity}</td><td>${naira(i.line_total)}</td></tr>`).join('')}
      <tr><td>Subtotal</td><td>${naira(order.subtotal)}</td></tr>
      <tr><td>Delivery fee</td><td>${naira(order.delivery_fee)}</td></tr>
      <tr><th>Total</th><th>${naira(order.total)}</th></tr>`;
    resultEl.classList.remove('hidden');
  } catch (err) {
    errorEl.className = 'alert alert-error';
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Track Order';
  }
}

document.getElementById('track-form').addEventListener('submit', (e) => {
  e.preventDefault();
  track(document.getElementById('order_number').value.trim(), document.getElementById('track_phone').value.trim());
});

// Support prefilled tracking links from the checkout confirmation page.
const params = new URLSearchParams(location.search);
if (params.get('order')) {
  document.getElementById('order_number').value = params.get('order');
  document.getElementById('track_phone').value = params.get('phone') || '';
  if (params.get('phone')) track(params.get('order'), params.get('phone'));
}

initLayout('track');
