// Injects the shared header/footer and loads restaurant settings.
let SETTINGS = null;

function renderHeader(active) {
  const header = document.getElementById('site-header');
  if (!header) return;
  header.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="/">
        <img src="/assets/logo.svg" alt="Iya Femi Restaurant logo">
        <span class="brand-name">Iya Femi Restaurant</span>
      </a>
      <button class="nav-toggle" aria-label="Toggle navigation" onclick="document.getElementById('site-nav').classList.toggle('open')">☰</button>
      <nav class="site-nav" id="site-nav" aria-label="Main navigation">
        <ul>
          <li><a href="/" ${active === 'home' ? 'class="active"' : ''}>Home</a></li>
          <li><a href="/menu.html" ${active === 'menu' ? 'class="active"' : ''}>Menu</a></li>
          <li><a href="/track.html" ${active === 'track' ? 'class="active"' : ''}>Track Order</a></li>
          <li><a href="/contact.html" ${active === 'contact' ? 'class="active"' : ''}>Contact</a></li>
          <li><a href="#" class="cart-link" onclick="toggleCart(true); return false;">Cart <span class="cart-count">0</span></a></li>
        </ul>
      </nav>
    </div>`;
}

function renderCartDrawerShell() {
  const shell = document.createElement('div');
  shell.innerHTML = `
    <div class="cart-overlay" id="cart-overlay" onclick="toggleCart(false)"></div>
    <aside class="cart-drawer" id="cart-drawer" aria-label="Shopping cart">
      <div class="cart-header">
        <strong>Your Cart</strong>
        <button aria-label="Close cart" onclick="toggleCart(false)">×</button>
      </div>
      <div class="cart-items" id="cart-items"></div>
      <div class="cart-footer">
        <div class="cart-total-row"><span>Subtotal</span><span id="cart-subtotal">₦0</span></div>
        <a href="/checkout.html" class="btn btn-primary" id="cart-checkout-btn" style="width:100%">Proceed to Checkout</a>
      </div>
    </aside>`;
  document.body.appendChild(shell);
}

function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer || !SETTINGS) return;
  const s = SETTINGS;
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <h3 style="color:var(--cream)">Iya Femi Restaurant</h3>
          <p>${escapeHtml(s.tagline)}</p>
          <p>${escapeHtml(s.address)}</p>
        </div>
        <div>
          <h3 style="color:var(--cream)">Contact</h3>
          <p>
            <a href="tel:${escapeHtml(s.phone_primary.replace(/\s/g, ''))}">${escapeHtml(s.phone_primary)}</a><br>
            ${s.phone_secondary ? `<a href="tel:${escapeHtml(s.phone_secondary.replace(/\s/g, ''))}">${escapeHtml(s.phone_secondary)}</a><br>` : ''}
            ${s.whatsapp_number ? `<a href="https://wa.me/${escapeHtml(s.whatsapp_number.replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">WhatsApp us</a>` : ''}
          </p>
        </div>
        <div>
          <h3 style="color:var(--cream)">Quick Links</h3>
          <p>
            <a href="/menu.html">Menu</a><br>
            <a href="/track.html">Track your order</a><br>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.maps_query)}" target="_blank" rel="noopener">Get directions</a>
          </p>
        </div>
      </div>
      <div class="footer-bottom">© ${new Date().getFullYear()} Iya Femi Restaurant, Minna, Niger State. All rights reserved.</div>
    </div>`;
}

async function initLayout(activePage) {
  renderHeader(activePage);
  renderCartDrawerShell();
  Cart.renderBadge();
  try {
    SETTINGS = await API.get('/settings/public');
    renderFooter();
    document.dispatchEvent(new CustomEvent('settings:loaded', { detail: SETTINGS }));
  } catch (err) {
    console.error('Failed to load settings', err);
  }
}
