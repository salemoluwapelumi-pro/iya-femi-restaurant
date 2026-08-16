// Cart stored in localStorage; totals shown here are estimates —
// the server recalculates everything at checkout (BR-016).
const Cart = {
  KEY: 'iyafemi_cart',
  read() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; }
  },
  write(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
    this.renderBadge();
  },
  add(item, qty = 1) {
    const items = this.read();
    const existing = items.find((i) => i.id === item.id);
    if (existing) existing.qty = Math.min(existing.qty + qty, 50);
    else items.push({ id: item.id, name: item.name, price: Number(item.price), qty });
    this.write(items);
    showToast(`${item.name} added to cart`);
  },
  setQty(id, qty) {
    let items = this.read();
    if (qty <= 0) items = items.filter((i) => i.id !== id);
    else items.forEach((i) => { if (i.id === id) i.qty = Math.min(qty, 50); });
    this.write(items);
  },
  clear() { this.write([]); },
  count() { return this.read().reduce((n, i) => n + i.qty, 0); },
  subtotal() { return this.read().reduce((s, i) => s + i.price * i.qty, 0); },
  renderBadge() {
    document.querySelectorAll('.cart-count').forEach((el) => { el.textContent = this.count(); });
  },
};

function renderCartDrawer() {
  const list = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-subtotal');
  if (!list) return;
  const items = Cart.read();
  if (!items.length) {
    list.innerHTML = '<p class="empty-state">Your cart is empty.<br>Add some delicious meals from the menu!</p>';
  } else {
    list.innerHTML = items.map((i) => `
      <div class="cart-item">
        <div>
          <strong>${escapeHtml(i.name)}</strong><br>
          <span class="muted">${naira(i.price)} each</span>
        </div>
        <div class="qty-control">
          <button aria-label="Decrease quantity" onclick="Cart.setQty(${i.id}, ${i.qty - 1}); renderCartDrawer();">−</button>
          <span>${i.qty}</span>
          <button aria-label="Increase quantity" onclick="Cart.setQty(${i.id}, ${i.qty + 1}); renderCartDrawer();">+</button>
        </div>
      </div>`).join('');
  }
  if (totalEl) totalEl.textContent = naira(Cart.subtotal());
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  if (checkoutBtn) checkoutBtn.disabled = !items.length;
}

function toggleCart(open) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer) return;
  const willOpen = open ?? !drawer.classList.contains('open');
  drawer.classList.toggle('open', willOpen);
  overlay.classList.toggle('open', willOpen);
  if (willOpen) renderCartDrawer();
}

document.addEventListener('DOMContentLoaded', () => Cart.renderBadge());
