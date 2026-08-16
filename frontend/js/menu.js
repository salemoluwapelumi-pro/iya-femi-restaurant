const state = { category: '', search: '', sort: '' };
let searchTimer;

function menuCard(item) {
  const img = item.image_url || '/assets/placeholder-food.svg';
  const cartArg = JSON.stringify({ id: item.id, name: item.name, price: item.price }).replace(/'/g, '&#39;');
  return `
    <article class="card">
      <img class="food-img" src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}" loading="lazy"
           onerror="this.src='/assets/placeholder-food.svg'">
      <div class="card-body">
        <div>
          <span class="badge badge-cat">${escapeHtml(item.category_name)}</span>
          ${item.featured ? '<span class="badge badge-featured">Popular</span>' : ''}
          ${!item.available ? '<span class="badge badge-unavailable">Unavailable</span>' : ''}
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="muted" style="font-size:0.9rem;margin:0">${escapeHtml(item.description)}</p>
        ${item.portion_info ? `<p class="muted" style="font-size:0.8rem;margin:0">${escapeHtml(item.portion_info)}</p>` : ''}
        <div class="price">${naira(item.price)}</div>
        <div class="card-actions">
          ${item.available
            ? `<button class="btn btn-primary btn-sm" onclick='Cart.add(${cartArg})'>Add to Cart</button>`
            : '<span class="muted" style="font-size:0.85rem">Check back later</span>'}
        </div>
      </div>
    </article>`;
}

async function loadMenu() {
  const grid = document.getElementById('menu-grid');
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>Loading menu…</div>';
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.search) params.set('search', state.search);
  if (state.sort) params.set('sort', state.sort);
  try {
    const menu = await API.get(`/menu?${params}`);
    grid.innerHTML = menu.length
      ? menu.map(menuCard).join('')
      : '<p class="empty-state">No meals match your search.</p>';
  } catch {
    grid.innerHTML = '<p class="empty-state">Could not load the menu. Please refresh.</p>';
  }
}

async function loadCategories() {
  const pills = document.getElementById('category-pills');
  try {
    const cats = await API.get('/categories');
    for (const c of cats) {
      const btn = document.createElement('button');
      btn.textContent = c.name;
      btn.dataset.slug = c.slug;
      pills.appendChild(btn);
    }
  } catch { /* keep "All" only */ }
  pills.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    pills.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    state.category = e.target.dataset.slug;
    loadMenu();
  });
}

document.getElementById('search-input').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value.trim();
    loadMenu();
  }, 350);
});
document.getElementById('sort-select').addEventListener('change', (e) => {
  state.sort = e.target.value;
  loadMenu();
});

document.addEventListener('settings:loaded', (e) => {
  if (!e.detail.is_open_now) {
    const banner = document.getElementById('closed-banner');
    banner.textContent = "We're currently closed. You can place an order for the next available opening.";
    banner.classList.remove('hidden');
  }
});

initLayout('menu');
loadCategories();
loadMenu();
