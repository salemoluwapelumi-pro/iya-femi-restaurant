const DAY_LABELS = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday'],
];

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function foodCard(item) {
  const img = item.image_url || '/assets/placeholder-food.svg';
  return `
    <article class="card">
      <img class="food-img" src="${escapeHtml(img)}" alt="${escapeHtml(item.name)}" loading="lazy"
           onerror="this.src='/assets/placeholder-food.svg'">
      <div class="card-body">
        <span class="badge badge-cat">${escapeHtml(item.category_name)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="muted" style="font-size:0.9rem;margin:0">${escapeHtml(item.description)}</p>
        <div class="price">${naira(item.price)}</div>
        <div class="card-actions">
          ${item.available
            ? `<button class="btn btn-primary btn-sm" onclick='Cart.add(${JSON.stringify({ id: item.id, name: item.name, price: item.price }).replace(/'/g, '&#39;')})'>Add to Cart</button>`
            : '<span class="badge badge-unavailable">Unavailable</span>'}
        </div>
      </div>
    </article>`;
}

async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  try {
    const menu = await API.get('/menu');
    const featured = menu.filter((m) => m.featured).slice(0, 4);
    const list = featured.length ? featured : menu.slice(0, 4);
    grid.innerHTML = list.length ? list.map(foodCard).join('') : '<p class="empty-state">Menu coming soon.</p>';
  } catch {
    grid.innerHTML = '<p class="empty-state">Could not load featured meals. Please refresh.</p>';
  }
}

async function loadReviews() {
  const grid = document.getElementById('reviews-grid');
  try {
    const reviews = await API.get('/reviews');
    if (!reviews.length) {
      grid.innerHTML = '<p class="empty-state">No reviews yet — be the first to leave one!</p>';
      return;
    }
    grid.innerHTML = reviews.slice(0, 6).map((r) => `
      <div class="review-card">
        <div class="stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <p>${escapeHtml(r.comment)}</p>
        <strong>${escapeHtml(r.customer_name)}</strong>
        ${r.verified_purchase ? '<span class="badge badge-featured">Verified order</span>' : ''}
      </div>`).join('');
  } catch {
    grid.innerHTML = '<p class="empty-state">Could not load reviews.</p>';
  }
}

document.addEventListener('settings:loaded', (e) => {
  const s = e.detail;
  const badge = document.getElementById('open-badge');
  badge.textContent = s.is_open_now ? '● Open now — taking orders' : '● Currently closed';
  badge.classList.add(s.is_open_now ? 'open' : 'closed');
  if (s.tagline) document.getElementById('hero-tagline').textContent = s.description || s.tagline;
  document.getElementById('about-text').textContent = s.description;
  document.getElementById('address-text').textContent = s.address;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.maps_query)}`;
  document.getElementById('directions-link').href = mapsUrl;
  document.getElementById('map-embed').src = `https://www.google.com/maps?q=${encodeURIComponent(s.maps_query)}&output=embed`;

  const phones = [s.phone_primary, s.phone_secondary, s.phone_tertiary].filter(Boolean);
  document.getElementById('phones-block').innerHTML = phones
    .map((p) => `<a href="tel:${escapeHtml(p.replace(/\s/g, ''))}">${escapeHtml(p)}</a>`)
    .join('<br>');

  try {
    const hours = JSON.parse(s.opening_hours);
    document.getElementById('hours-table').innerHTML = DAY_LABELS.map(([key, label]) => {
      const d = hours[key];
      const value = !d || d.closed ? 'Closed' : `${formatTime(d.open)} – ${formatTime(d.close)}`;
      return `<tr><td>${label}</td><td>${value}</td></tr>`;
    }).join('');
  } catch { /* leave hours empty */ }
});

initLayout('home');
loadFeatured();
loadReviews();
